const { 
    default: makeWASocket, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const { useCloudAuthState } = require('./cloudAuthState');

/**
 * Creates and manages a Baileys WhatsApp client instance backed by Cloud Auth State
 * 
 * @param {Object} options
 * @param {string} options.channelId - Channel UUID
 * @param {import('@supabase/supabase-js').SupabaseClient} options.supabase - Supabase Client
 * @param {string} options.encryptionKey - AES-256 Secret
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
        encryptionKey,
        onQr,
        onConnected,
        onDisconnected,
        onMessage
    } = options;

    if (!channelId || !supabase || !encryptionKey) {
        throw new Error('channelId, supabase, and encryptionKey are required');
    }

    const logger = pino({ level: 'silent' });
    const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: true }));
    console.log(`[WhatsAppClient] Using Baileys version ${version.join('.')} (Latest: ${isLatest})`);

    // Hydrate state from Cloud Auth State (zero local file locks)
    const { state, saveCreds } = await useCloudAuthState(supabase, channelId, encryptionKey);

    let isConnectedState = false;
    let shouldReconnect = true;

    const sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ['KWADER Desktop Sync', 'Desktop', '2.4.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        generateHighQualityLinkPreview: false,
        getMessage: async (key) => {
            // Optional message store lookup
            return undefined;
        }
    });

    // 1. Save credentials automatically on rotation
    sock.ev.on('creds.update', async () => {
        try {
            await saveCreds();
        } catch (err) {
            console.error('[WhatsAppClient] Error in saveCreds:', err.message);
        }
    });

    // 2. Handle Connection Lifecycle
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Handle QR Code
        if (qr) {
            try {
                const qrDataUrl = await QRCode.toDataURL(qr);
                
                // Update Supabase channel record with QR
                await supabase
                    .from('whatsapp_channels')
                    .update({
                        qr_code: qrDataUrl,
                        status: 'waiting_for_qr',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', channelId);

                console.log(`[WhatsAppClient] New QR code generated for channel: ${channelId}`);
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

            console.log(`[WhatsAppClient] ✅ Connection established! Connected as: ${phoneNumber}`);

            // Clear QR and update channel to connected in Supabase
            await supabase
                .from('whatsapp_channels')
                .update({
                    status: 'connected',
                    phone_number: phoneNumber,
                    qr_code: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', channelId);

            if (onConnected) onConnected(sock);
        }

        // Handle Connection Closed
        if (connection === 'close') {
            isConnectedState = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;

            console.log(`[WhatsAppClient] ⚠️ Connection closed. Status code: ${statusCode} (Logged Out: ${isLoggedOut})`);

            if (isLoggedOut) {
                console.warn('[WhatsAppClient] Device was logged out. Clearing cloud session keys...');
                // Delete all session keys for this channel
                await supabase
                    .from('whatsapp_session_keys')
                    .delete()
                    .eq('channel_id', channelId);

                await supabase
                    .from('whatsapp_channels')
                    .update({
                        status: 'disconnected',
                        phone_number: null,
                        qr_code: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', channelId);

                shouldReconnect = false;
            } else {
                // Temporary disconnect
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

    // 3. Handle Incoming Messages
    sock.ev.on('messages.upsert', async (m) => {
        if (onMessage) {
            onMessage(m);
        }
    });

    return {
        sock,
        disconnect: () => {
            shouldReconnect = false;
            try {
                sock.end();
            } catch (e) {
                // ignore
            }
        },
        isConnected: () => isConnectedState
    };
}

module.exports = {
    initWhatsAppClient
};
