const { 
    default: makeWASocket, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const { pullSessionFromGithub, pushSessionToGithub } = require('./githubSync');

/**
 * Creates and manages a Baileys WhatsApp client instance backed by GitHub Session Sync.
 * 
 * Session is stored locally in auth_info_baileys/ and synced to/from GitHub
 * to enable seamless leader failover across different machines.
 *
 * @param {Object} options
 * @param {string} options.channelId - Channel UUID
 * @param {import('@supabase/supabase-js').SupabaseClient} options.supabase - Supabase Client
 * @param {string} options.encryptionKey - AES-256 Secret (kept for API compatibility)
 * @param {Function} [options.onQr] - Callback when QR is generated (dataUrl, rawQr)
 * @param {Function} [options.onConnected] - Callback when WhatsApp connection is open
 * @param {Function} [options.onDisconnected] - Callback when disconnected (reason)
 * @param {Function} [options.onMessage] - Callback for incoming messages
 * @returns {Promise<{ sock: any, disconnect: () => void, isConnected: () => boolean }>}
 */
async function initWhatsAppClient(options) {
    const {
        channelId,
        supabase,
        onQr,
        onConnected,
        onDisconnected,
        onMessage
    } = options;

    if (!channelId || !supabase) {
        throw new Error('channelId and supabase are required');
    }

    const logger = pino({ level: 'silent' });
    const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ 
        version: [2, 3000, 1015901307], 
        isLatest: true 
    }));
    console.log(`[WhatsAppClient] Using Baileys v${version.join('.')} (Latest: ${isLatest})`);

    // --- Step 1: Pull latest session from GitHub before starting ---
    // This is the core of the failover mechanism: the new leader inherits the session.
    await pullSessionFromGithub();

    // --- Step 2: Hydrate local auth state ---
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    let isConnectedState = false;
    let shouldReconnect = true;

    // FIX: Track the periodic sync interval outside onConnected to prevent
    // memory leak from creating multiple intervals on reconnect cycles.
    let githubSyncIntervalId = null;

    const sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ['KWADER Desktop Sync', 'Desktop', '2.6.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined
    });

    // --- Event: Save credentials on rotation ---
    sock.ev.on('creds.update', async () => {
        try {
            await saveCreds();
        } catch (err) {
            console.error('[WhatsAppClient] Error in saveCreds:', err.message);
        }
    });

    // --- Event: Connection lifecycle ---
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Handle QR Code generation
        if (qr) {
            try {
                const qrDataUrl = await QRCode.toDataURL(qr);
                
                await supabase
                    .from('whatsapp_channels')
                    .update({
                        qr_code: qrDataUrl,
                        status: 'waiting_for_qr',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', channelId);

                console.log(`[WhatsAppClient] 📱 QR code ready for channel: ${channelId}`);
                if (onQr) onQr(qrDataUrl, qr);
            } catch (err) {
                console.error('[WhatsAppClient] Failed generating/saving QR:', err.message);
            }
        }

        // Handle Connection Opened
        if (connection === 'open') {
            isConnectedState = true;
            const fullJid = sock.user?.id || '';
            const phoneNumber = fullJid.split(':')[0] || fullJid.split('@')[0] || '';

            console.log(`[WhatsAppClient] ✅ Connected as: +${phoneNumber}`);

            // Update channel status in Supabase
            await supabase
                .from('whatsapp_channels')
                .update({
                    status: 'connected',
                    phone_number: phoneNumber,
                    qr_code: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', channelId);

            // Push session to GitHub immediately so all standby nodes have the latest keys
            pushSessionToGithub();

            // FIX: Clear any existing sync interval before creating a new one.
            // Without this, reconnect cycles create multiple intervals → memory leak + duplicate pushes.
            if (githubSyncIntervalId) {
                clearInterval(githubSyncIntervalId);
            }
            // Push every 30 minutes to capture Signal pre-key rotations
            githubSyncIntervalId = setInterval(() => {
                if (isConnectedState) {
                    console.log('[WhatsAppClient] ⏱️ Periodic session sync to GitHub...');
                    pushSessionToGithub();
                }
            }, 30 * 60 * 1000);

            if (onConnected) onConnected(sock);
        }

        // Handle Connection Closed
        if (connection === 'close') {
            isConnectedState = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;

            console.log(`[WhatsAppClient] ⚠️ Connection closed. Code: ${statusCode} | LoggedOut: ${isLoggedOut}`);

            // Clear sync interval on disconnect to avoid pushing stale state
            if (githubSyncIntervalId) {
                clearInterval(githubSyncIntervalId);
                githubSyncIntervalId = null;
            }

            if (isLoggedOut) {
                console.warn('[WhatsAppClient] 🔴 Device was logged out. QR re-scan required.');
                shouldReconnect = false;

                await supabase
                    .from('whatsapp_channels')
                    .update({
                        status: 'disconnected',
                        phone_number: null,
                        qr_code: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', channelId);
            } else {
                // Temporary disconnect — Baileys will auto-reconnect
                await supabase
                    .from('whatsapp_channels')
                    .update({
                        status: 'connecting',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', channelId);
            }

            if (onDisconnected) onDisconnected({ statusCode, isLoggedOut, shouldReconnect });
        }
    });

    // --- Event: Incoming Messages ---
    sock.ev.on('messages.upsert', async (m) => {
        if (onMessage) {
            onMessage(m, sock);
        }
    });

    return {
        sock,
        disconnect: () => {
            shouldReconnect = false;
            // Clear periodic sync before destroying socket
            if (githubSyncIntervalId) {
                clearInterval(githubSyncIntervalId);
                githubSyncIntervalId = null;
            }
            try {
                sock.ev.removeAllListeners();
                sock.end();
            } catch (e) {
                // ignore cleanup errors
            }
        },
        isConnected: () => isConnectedState
    };
}

module.exports = {
    initWhatsAppClient
};
