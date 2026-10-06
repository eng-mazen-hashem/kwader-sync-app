const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Manages Distributed Leases, Leader Election, and Anti-Split-Brain Protection
 */
class LeaseManager {
    /**
     * @param {Object} options
     * @param {import('@supabase/supabase-js').SupabaseClient} options.supabase
     * @param {string} options.channelId
     * @param {string} [options.nodeId]
     * @param {number} [options.leaseDurationSeconds=15]
     * @param {number} [options.heartbeatIntervalMs=5000]
     * @param {Function} options.onBecameLeader
     * @param {Function} options.onStepDown
     */
    constructor(options) {
        this.supabase = options.supabase;
        this.channelId = options.channelId;
        this.nodeId = options.nodeId || this.getOrCreateNodeId();
        this.leaseDurationSeconds = options.leaseDurationSeconds || 30;
        this.heartbeatIntervalMs = options.heartbeatIntervalMs || 10000;
        this.onBecameLeader = options.onBecameLeader;
        this.onStepDown = options.onStepDown;
        this.getActiveSessionsCount = options.getActiveSessionsCount || (() => 0);

        this.role = 'standby'; // 'standby' | 'leader'
        this.currentEpoch = null;
        this.heartbeatTimer = null;
        this.electionPollTimer = null;
        this.realtimeSubscription = null;
        this.isShuttingDown = false;
    }

    /**
     * Retrieves or generates a consistent persistent Node ID for this host
     */
    getOrCreateNodeId() {
        try {
            const idFilePath = path.join(__dirname, '.cluster_node_id');
            if (fs.existsSync(idFilePath)) {
                const id = fs.readFileSync(idFilePath, 'utf8').trim();
                if (id) return id;
            }
            const newId = `node_${os.hostname()}_${crypto.randomBytes(3).toString('hex')}`;
            fs.writeFileSync(idFilePath, newId, 'utf8');
            return newId;
        } catch {
            return `node_${os.hostname()}_${crypto.randomBytes(3).toString('hex')}`;
        }
    }

    /**
     * Computes node health score (0-100) based on free memory and stability
     */
    calculateHealthScore() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const freeMemRatio = freeMem / totalMem;
        
        let score = 100;
        if (freeMemRatio < 0.10) score -= 40;
        else if (freeMemRatio < 0.20) score -= 20;

        const uptime = os.uptime();
        if (uptime < 60) score -= 10;

        return Math.max(10, score);
    }

    getMemoryRssMb() {
        return Math.round(process.memoryUsage().rss / 1024 / 1024);
    }

    /**
     * Starts the election loop and realtime watcher
     */
    async start() {
        console.log(`[LeaseManager] Starting node ${this.nodeId} for channel ${this.channelId}...`);
        
        // 1. Subscribe to Supabase Realtime channel updates
        this.setupRealtimeSubscription();

        // 2. Initial attempt to acquire lease (with Load Balancing Jitter)
        const activeSessions = this.getActiveSessionsCount();
        const initialDelay = (activeSessions * 2500) + Math.floor(Math.random() * 1000);
        
        if (initialDelay > 0) {
            console.log(`[LeaseManager] Load balancing: Node has ${activeSessions} active sessions. Delaying initial election by ${initialDelay}ms to allow empty nodes to win.`);
        }
        
        setTimeout(async () => {
            if (!this.isShuttingDown) {
                await this.attemptAcquireLease();
                // 3. Fallback election polling
                this.scheduleNextElectionCheck();
            }
        }, initialDelay);

        // 4. Hook process exit signals for graceful handover
        this.setupExitHooks();
    }

    setupRealtimeSubscription() {
        // PRO FIX: Realtime disabled for whatsapp_channels to save massive quota bleed.
        // Heartbeats update the channel every 5s, which was broadcasting 160,000 WebSocket events per day.
        // The election poll timer (every 6-10s) is completely sufficient for failover without destroying quota.
        console.log('[LeaseManager] Realtime preemption disabled to save 100% of Supabase quota. Relying on polling.');
    }

    scheduleNextElectionCheck() {
        if (this.isShuttingDown || this.role === 'leader') return;

        // Dynamic jitter: healthier nodes poll faster
        const health = this.calculateHealthScore();
        const baseInterval = 12000;
        
        // Fair Load Balancing: Heavily loaded nodes wait longer, giving empty nodes the chance to win the race.
        const activeSessions = this.getActiveSessionsCount();
        const loadPenalty = activeSessions * 3000; // +3 seconds per active session
        const jitter = Math.floor(Math.random() * 2000) + (100 - health) * 30;
        
        const delay = baseInterval + jitter + loadPenalty;

        clearTimeout(this.electionPollTimer);
        this.electionPollTimer = setTimeout(async () => {
            if (this.role === 'standby' && !this.isShuttingDown) {
                await this.attemptAcquireLease();
                this.scheduleNextElectionCheck();
            }
        }, delay);
    }

    /**
     * Atomically acquires the lease via RPC
     */
    async attemptAcquireLease() {
        if (this.isShuttingDown) return;
        const health = this.calculateHealthScore();

        try {
            const { data, error } = await this.supabase.rpc('acquire_whatsapp_lease', {
                p_node_id: this.nodeId,
                p_channel_id: this.channelId,
                p_lease_duration_seconds: this.leaseDurationSeconds,
                p_health_score: health
            });

            if (error) {
                console.error('[LeaseManager] Error calling acquire_whatsapp_lease:', error.message);
                return;
            }

            if (data && data.acquired === true) {
                this.role = 'leader';
                this.currentEpoch = data.epoch;
                console.log(`[LeaseManager] 👑 PROMOTED TO LEADER! Epoch: ${data.epoch}, Lease Expires: ${data.expires_at}`);
                
                clearTimeout(this.electionPollTimer);
                this.startHeartbeatLoop();

                if (this.onBecameLeader) {
                    this.onBecameLeader({ epoch: this.currentEpoch, nodeId: this.nodeId });
                }
            } else {
                if (this.role !== 'standby') {
                    this.role = 'standby';
                }
                // Log leader presence without spamming
                // console.log(`[LeaseManager] Standby. Active Leader: ${data?.current_leader}`);
            }
        } catch (err) {
            console.error('[LeaseManager] Exception in attemptAcquireLease:', err.message);
        }
    }

    /**
     * Runs heartbeat renewals every 5s while leader
     */
    startHeartbeatLoop() {
        clearInterval(this.heartbeatTimer);

        this.heartbeatTimer = setInterval(async () => {
            if (this.role !== 'leader' || this.isShuttingDown) {
                clearInterval(this.heartbeatTimer);
                return;
            }

            await this.renewHeartbeat();
        }, this.heartbeatIntervalMs);
    }

    async renewHeartbeat() {
        const health = this.calculateHealthScore();
        const memRss = this.getMemoryRssMb();

        try {
            const { data, error } = await this.supabase.rpc('renew_whatsapp_heartbeat', {
                p_node_id: this.nodeId,
                p_channel_id: this.channelId,
                p_epoch: this.currentEpoch,
                p_lease_duration_seconds: this.leaseDurationSeconds,
                p_health_score: health,
                p_memory_rss_mb: memRss
            });

            if (error) {
                console.error('[LeaseManager] Error renewing heartbeat:', error.message);
                return;
            }

            if (data && data.renewed === true) {
                // Heartbeat extended successfully
            } else {
                console.warn('[LeaseManager] ❌ Heartbeat renewal rejected! Reason:', data?.error || data);
                if (data?.action === 'step_down' || data?.error === 'fencing_token_expired') {
                    await this.stepDown('fencing_token_expired');
                }
            }
        } catch (err) {
            console.error('[LeaseManager] Exception in renewHeartbeat:', err.message);
        }
    }

    /**
     * Demotes this node to standby and triggers teardown callback
     */
    async stepDown(reason) {
        if (this.role !== 'leader') return;
        console.log(`[LeaseManager] Stepping down from Leader. Reason: ${reason}`);
        
        this.role = 'standby';
        clearInterval(this.heartbeatTimer);

        if (this.onStepDown) {
            await this.onStepDown(reason);
        }

        this.scheduleNextElectionCheck();
    }

    /**
     * Graceful exit: releases lease in DB instantly so another standby node takes over sub-second
     */
    async shutdown(reason = 'graceful_shutdown') {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;
        console.log(`[LeaseManager] Gracefully shutting down node ${this.nodeId}...`);

        clearInterval(this.heartbeatTimer);
        clearTimeout(this.electionPollTimer);

        if (this.realtimeSubscription) {
            this.supabase.removeChannel(this.realtimeSubscription);
        }

        if (this.role === 'leader') {
            try {
                console.log('[LeaseManager] Releasing lease cooperatively in database...');
                await this.supabase.rpc('release_whatsapp_lease', {
                    p_node_id: this.nodeId,
                    p_channel_id: this.channelId,
                    p_reason: reason
                });
                console.log('[LeaseManager] ✅ Lease successfully released.');
            } catch (err) {
                console.error('[LeaseManager] Failed to release lease:', err.message);
            }

            if (this.onStepDown) {
                await this.onStepDown(reason);
            }
        }

        this.role = 'standby';
    }

    setupExitHooks() {
        // NOTE: SIGINT/SIGTERM are handled as a singleton in server.js
        // to avoid registering duplicate handlers per channel in multi-tenant mode.
        // This method is kept for compatibility but does nothing.
    }
}

module.exports = {
    LeaseManager
};
