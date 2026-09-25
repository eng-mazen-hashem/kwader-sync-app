const https = require('https');
const http = require('http');

/**
 * Downloads a remote file into a buffer
 * @param {string} url 
 * @returns {Promise<Buffer>}
 */
function downloadFile(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download file, HTTP ${res.statusCode}`));
            }
            const data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
}

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class QueueProcessor {
    /**
     * @param {Object} options
     * @param {import('@supabase/supabase-js').SupabaseClient} options.supabase
     * @param {string} options.channelId
     * @param {string} options.nodeId
     * @param {() => any} options.getSocket - Returns active Baileys socket
     * @param {() => boolean} options.isLeader - Returns true if current node is LEADER
     */
    constructor(options) {
        this.supabase = options.supabase;
        this.channelId = options.channelId;
        this.nodeId = options.nodeId;
        this.getSocket = options.getSocket;
        this.isLeader = options.isLeader;

        this.isRunning = false;
        this.isProcessing = false;
        this.pollIntervalMs = 3500;
        this.pollTimer = null;
        this.realtimeSub = null;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`[QueueProcessor] Started for channel ${this.channelId}...`);

        this.setupRealtime();
        this.schedulePoll(1000);
    }

    stop() {
        this.isRunning = false;
        clearTimeout(this.pollTimer);
        if (this.realtimeSub) {
            this.supabase.removeChannel(this.realtimeSub);
            this.realtimeSub = null;
        }
        console.log('[QueueProcessor] Stopped.');
    }

    setupRealtime() {
        try {
            const topic = `wa_queue_${this.channelId}_${this.nodeId}`;
            this.realtimeSub = this.supabase
                .channel(topic)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'whatsapp_queue'
                    },
                    (payload) => {
                        if (!this.isRunning || !this.isLeader()) return;
                        const row = payload.new;
                        // Process if for our channel or unassigned channel
                        if (!row.channel_id || row.channel_id === this.channelId) {
                            this.schedulePoll(300);
                        }
                    }
                )
                .subscribe();
        } catch (err) {
            console.error('[QueueProcessor] Error setting up realtime queue:', err.message);
        }
    }

    schedulePoll(delayMs = this.pollIntervalMs) {
        if (!this.isRunning) return;
        clearTimeout(this.pollTimer);
        this.pollTimer = setTimeout(async () => {
            if (this.isRunning && this.isLeader()) {
                await this.processNextBatch();
            }
            if (this.isRunning) {
                this.schedulePoll();
            }
        }, delayMs);
    }

    /**
     * Formats phone number into standard WhatsApp JID
     * @param {string} phone 
     * @returns {string} JID
     */
    formatJid(phone) {
        let cleaned = (phone || '').replace(/\D/g, '');
        if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
        // E.164 normalization for Egypt numbers without country code
        if (cleaned.length === 11 && cleaned.startsWith('01')) {
            cleaned = '2' + cleaned;
        } else if (cleaned.length === 10 && cleaned.startsWith('1')) {
            cleaned = '20' + cleaned;
        }
        return `${cleaned}@s.whatsapp.net`;
    }

    async processNextBatch() {
        if (this.isProcessing || !this.isLeader()) return;
        const sock = this.getSocket();
        if (!sock) return;

        this.isProcessing = true;
        try {
            // 1. Fetch pending messages ordered by priority DESC, created_at ASC
            let query = this.supabase
                .from('whatsapp_queue')
                .select('*')
                .eq('status', 'pending')
                .order('priority', { ascending: false })
                .order('created_at', { ascending: true })
                .limit(5);

            if (this.channelId) {
                query = query.or(`channel_id.eq.${this.channelId},channel_id.is.null`);
            }

            const { data: messages, error } = await query;
            if (error) {
                console.error('[QueueProcessor] Fetch error:', error.message);
                return;
            }

            if (!messages || messages.length === 0) {
                return;
            }

            for (const msg of messages) {
                if (!this.isRunning || !this.isLeader()) break;

                // 2. Claim message atomically (optimistic concurrency lock)
                const { data: claimed, error: claimErr } = await this.supabase
                    .from('whatsapp_queue')
                    .update({
                        status: 'processing',
                        node_id: this.nodeId,
                        processed_at: new Date().toISOString()
                    })
                    .eq('id', msg.id)
                    .eq('status', 'pending')
                    .select();

                if (claimErr || !claimed || claimed.length === 0) {
                    // Claimed by another worker or already handled
                    continue;
                }

                await this.sendMessageWithThrottling(sock, msg);
            }
        } catch (err) {
            console.error('[QueueProcessor] Exception in processNextBatch:', err.message);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Sends message with humanized anti-ban simulation
     */
    async sendMessageWithThrottling(sock, item) {
        const jid = this.formatJid(item.phone);
        console.log(`[QueueProcessor] Sending message #${item.id} (Priority: ${item.priority || 0}) to ${jid}...`);

        try {
            // 1. Anti-Ban: Humanized Presence Simulation (composing indicator)
            try {
                await sock.sendPresenceUpdate('composing', jid);
            } catch {
                // Ignore presence errors
            }

            // Simulated typing delay: 1000ms - 2200ms
            const typingDelay = Math.floor(Math.random() * 1200) + 1000;
            await sleep(typingDelay);

            // 2. Send Media (PDF) if provided, otherwise Text
            if (item.pdf_url) {
                const pdfBuffer = await downloadFile(item.pdf_url);
                await sock.sendMessage(jid, {
                    document: pdfBuffer,
                    mimetype: 'application/pdf',
                    fileName: 'document.pdf',
                    caption: item.message || ''
                });
            } else {
                await sock.sendMessage(jid, {
                    text: item.message
                });
            }

            // Stop composing presence
            try {
                await sock.sendPresenceUpdate('paused', jid);
            } catch {}

            // 3. Mark message as sent
            await this.supabase
                .from('whatsapp_queue')
                .update({
                    status: 'sent',
                    processed_at: new Date().toISOString(),
                    error: null
                })
                .eq('id', item.id);

            console.log(`[QueueProcessor] ✅ Message #${item.id} sent successfully!`);

            // 4. Anti-Ban Jitter Delay before releasing lock for next message: 2000ms - 4500ms
            const antiBanJitter = Math.floor(Math.random() * 2500) + 2000;
            await sleep(antiBanJitter);

        } catch (err) {
            console.error(`[QueueProcessor] ❌ Failed to send message #${item.id}:`, err.message);
            
            await this.supabase
                .from('whatsapp_queue')
                .update({
                    status: 'failed',
                    error: err.message,
                    processed_at: new Date().toISOString()
                })
                .eq('id', item.id);
        }
    }
}

module.exports = {
    QueueProcessor
};
