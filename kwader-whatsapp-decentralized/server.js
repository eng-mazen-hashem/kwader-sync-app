require('dotenv').config();
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const { LeaseManager } = require('./leaseManager');
const { initWhatsAppClient } = require('./whatsappClient');
const { QueueProcessor } = require('./queueProcessor');

// Environment Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://whuopqnhmsevlilkcfre.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_CHANNEL_ID = process.env.DEFAULT_CHANNEL_ID || '2a326ace-afbd-47b9-927e-25e44fb973cd';
const SESSION_ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || 'kwader_cluster_secret_aes_key_2026_x99';
const HTTP_PORT = parseInt(process.env.PORT || '3001', 10);

if (!SUPABASE_KEY) {
    console.error('❌ FATAL: SUPABASE_SERVICE_ROLE_KEY is required!');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('═══════════════════════════════════════════════════════════════');
console.log(' 🚀 KWADER Decentralized WhatsApp Cluster Engine (Baileys) v2.4 ');
console.log('═══════════════════════════════════════════════════════════════');

let activeClient = null;
let queueProcessor = null;
let currentRole = 'standby';
let currentEpoch = 0;
let isConnected = false;
let activePhoneNumber = null;

// Initialize Lease Manager
const leaseManager = new LeaseManager({
    supabase,
    channelId: DEFAULT_CHANNEL_ID,
    leaseDurationSeconds: 15,
    heartbeatIntervalMs: 5000,
    onBecameLeader: async ({ epoch, nodeId }) => {
        currentRole = 'leader';
        currentEpoch = epoch;
        console.log(`\n👑 [Cluster] Node elected as LEADER! Starting WhatsApp Engine (Epoch ${epoch})...`);
        
        try {
            await startWhatsAppLeaderEngine();
        } catch (err) {
            console.error('[Cluster] Failed starting WhatsApp engine on promotion:', err.message);
        }
    },
    onStepDown: async (reason) => {
        currentRole = 'standby';
        isConnected = false;
        console.log(`\n🔻 [Cluster] Stepping down to STANDBY. Reason: ${reason}`);
        
        await stopWhatsAppLeaderEngine();
    }
});

async function startWhatsAppLeaderEngine() {
    if (activeClient) {
        activeClient.disconnect();
        activeClient = null;
    }

    if (queueProcessor) {
        queueProcessor.stop();
        queueProcessor = null;
    }

    // Initialize Baileys client with Cloud Auth State
    activeClient = await initWhatsAppClient({
        channelId: DEFAULT_CHANNEL_ID,
        supabase,
        encryptionKey: SESSION_ENCRYPTION_KEY,
        onConnected: (sock) => {
            isConnected = true;
            const fullJid = sock.user?.id || '';
            activePhoneNumber = fullJid.split(':')[0] || fullJid.split('@')[0] || '';
            console.log(`🎉 [WhatsApp] Connected as: ${activePhoneNumber}`);

            // Start queue processing once connected
            if (!queueProcessor) {
                queueProcessor = new QueueProcessor({
                    supabase,
                    channelId: DEFAULT_CHANNEL_ID,
                    nodeId: leaseManager.nodeId,
                    getSocket: () => activeClient?.sock,
                    isLeader: () => currentRole === 'leader' && isConnected
                });
                queueProcessor.start();
            }
        },
        onDisconnected: ({ statusCode, isLoggedOut }) => {
            isConnected = false;
            console.warn(`⚠️ [WhatsApp] Disconnected. Status: ${statusCode}, LoggedOut: ${isLoggedOut}`);
            if (queueProcessor) {
                queueProcessor.stop();
            }
        },
        onMessage: async (msgUpsert) => {
            // Can be routed to AI Assistant / Customer Service
        }
    });
}

async function stopWhatsAppLeaderEngine() {
    if (queueProcessor) {
        queueProcessor.stop();
        queueProcessor = null;
    }

    if (activeClient) {
        console.log('[WhatsApp] Disconnecting socket cleanly on step down...');
        activeClient.disconnect();
        activeClient = null;
    }
}

// Local lightweight HTTP status API for Sync Agent UI
const server = http.createServer((req, res) => {
    if (req.url === '/status' || req.url === '/api/status') {
        const memRss = Math.round(process.memoryUsage().rss / 1024 / 1024);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
            status: 'online',
            nodeId: leaseManager.nodeId,
            channelId: DEFAULT_CHANNEL_ID,
            role: currentRole,
            epoch: currentEpoch,
            whatsappConnected: isConnected,
            phoneNumber: activePhoneNumber,
            memoryRssMb: memRss,
            uptimeSeconds: Math.round(process.uptime()),
            timestamp: new Date().toISOString()
        }));
        return;
    }

    if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('pong');
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`📡 Local Status API listening on http://127.0.0.1:${HTTP_PORT}`);
    // Start lease election loop
    leaseManager.start();
});

// Handle graceful shutdown
const handleExit = async (sig) => {
    console.log(`\n🛑 Received ${sig}. Exiting gracefully...`);
    server.close();
    await leaseManager.shutdown(`signal_${sig}`);
    await stopWhatsAppLeaderEngine();
    process.exit(0);
};

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));
