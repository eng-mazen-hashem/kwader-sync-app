const { 
    default: makeWASocket, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const { useCloudAuthState } = require('./cloudAuthState');
const { pushSessionToGithub } = require('./githubSync');

/**
 * Creates and manages a Baileys WhatsApp client instance.
 * 
 * Session storage strategy (in priority order):
 *  1. Supabase Cloud (whatsapp_session_keys table) — primary, enables cross-device failover
 *  2. Local files (auth_info_baileys/) — fallback when Supabase session is empty/new
 *
 * This means when a new leader node is elected on ANY machine, it can restore
 * the session directly from Supabase without needing GitHub sync or local files.
 *
 * @param {Object} options
 * @param {string} options.channelId - Channel UUID
 * @param {import('@supabase/supabase-js').SupabaseClient} options.supabase - Supabase Client
 * @param {string} options.encryptionKey - AES-256 Secret for session encryption
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

    if (!channelId || !supabase) {
        throw new Error('channelId and supabase are required');
    }

    const logger = pino({ level: 'silent' });
    const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ 
        version: [2, 3000, 1015901307], 
        isLatest: true 
    }));
    console.log(`[WhatsAppClient] Using Baileys v${version.join('.')} (Latest: ${isLatest})`);

    // --- Step 1: Load auth state ---
    // Try Supabase Cloud first (enables cross-device failover).
    // Fall back to local files if cloud has no session yet (first-time setup).
    let state, saveCreds, usingCloudSession = false;

    try {
        if (encryptionKey) {
            console.log('[WhatsAppClient] Loading session from Supabase Cloud...');
            const cloudAuth = await useCloudAuthState(supabase, channelId, encryptionKey);
            
            // Check if cloud session has valid credentials
            if (cloudAuth.state.creds && cloudAuth.state.creds.me) {
                state = cloudAuth.state;
                saveCreds = cloudAuth.saveCreds;
                usingCloudSession = true;
                console.log(`[WhatsAppClient] ✅ Cloud session loaded for: +${cloudAuth.state.creds.me.id?.split(':')[0] || cloudAuth.state.creds.me.id}`);
            } else {
                console.log('[WhatsAppClient] Cloud session empty. Checking local files...');
                // Try local file session as fallback
                try {
                    const localAuth = await useMultiFileAuthState(`auth_info_baileys_${channelId}`);
                    if (localAuth.state.creds && localAuth.state.creds.me) {
                        state = localAuth.state;
                        console.log('[WhatsAppClient] ✅ Local file session found. Will save to cloud on connect.');
                        // Save local session to cloud so future leaders can use it
                        saveCreds = async () => {
                            await localAuth.saveCreds();
                            await cloudAuth.saveCreds.call({ creds: localAuth.state.creds }, cloudAuth.state.creds = localAuth.state.creds);
                        };
                    } else {
                        // No valid session anywhere — use cloud auth (will trigger QR)
                        state = cloudAuth.state;
                        saveCreds = cloudAuth.saveCreds;
                        console.log('[WhatsAppClient] No existing session found. QR code will be generated.');
                    }
                } catch (localErr) {
                    console.log('[WhatsAppClient] Local session load failed:', localErr.message);
                    state = cloudAuth.state;
                    saveCreds = cloudAuth.saveCreds;
                }
            }
        } else {
            throw new Error('No encryption key');
        }
    } catch (cloudErr) {
        console.warn('[WhatsAppClient] Cloud auth unavailable:', cloudErr.message, '— falling back to local files.');
        try {
            const localAuth = await useMultiFileAuthState(`auth_info_baileys_${channelId}`);
            state = localAuth.state;
            saveCreds = localAuth.saveCreds;
        } catch (localErr) {
            console.error('[WhatsAppClient] CRITICAL: Both cloud and local auth failed:', localErr.message);
            throw localErr;
        }
    }

    let isConnectedState = false;
    let shouldReconnect = true;

    // Track the periodic sync interval to prevent memory leaks on reconnect cycles
    let periodicSyncIntervalId = null;

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

            // If we loaded from local files, push to cloud now for cross-device failover
            if (!usingCloudSession && encryptionKey) {
                console.log('[WhatsAppClient] Migrating local session to Supabase Cloud for failover support...');
                try {
                    const cloudAuth = await useCloudAuthState(supabase, channelId, encryptionKey);
                    // The creds.update event will trigger saveCreds automatically going forward
                    // Force a save of current creds to cloud
                    const { BufferJSON } = require('@whiskeysockets/baileys');
                    const { encrypt } = require('./encryption');
                    const serialized = JSON.stringify(state.creds, BufferJSON.replacer);
                    const encrypted = encrypt(serialized, encryptionKey);
                    await supabase.from('whatsapp_session_keys').upsert({
                        channel_id: channelId,
                        key_type: 'creds',
                        key_id: 'default',
                        key_data: encrypted,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'channel_id,key_type,key_id' });
                    usingCloudSession = true;
                    console.log('[WhatsAppClient] ✅ Session migrated to Supabase Cloud successfully.');
                } catch (e) {
                    console.warn('[WhatsAppClient] Could not migrate session to cloud:', e.message);
                }
            }

            // Push to GitHub as backup (non-blocking, failures are OK)
            pushSessionToGithub();

            // FIX: Clear any existing sync interval before creating a new one.
            if (periodicSyncIntervalId) {
                clearInterval(periodicSyncIntervalId);
            }
            // Push to GitHub every 30 minutes to capture Signal pre-key rotations
            periodicSyncIntervalId = setInterval(() => {
                if (isConnectedState) {
                    console.log('[WhatsAppClient] ⏱️ Periodic session backup to GitHub...');
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

            // Clear sync interval on disconnect
            if (periodicSyncIntervalId) {
                clearInterval(periodicSyncIntervalId);
                periodicSyncIntervalId = null;
            }

            if (isLoggedOut) {
                console.warn('[WhatsAppClient] 🔴 Device was logged out. QR re-scan required.');
                shouldReconnect = false;

                // Clear cloud session to force fresh QR on next connect
                try {
                    await supabase
                        .from('whatsapp_session_keys')
                        .delete()
                        .eq('channel_id', channelId);
                    console.log('[WhatsAppClient] Cloud session cleared after logout.');
                } catch (e) {}

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
            if (periodicSyncIntervalId) {
                clearInterval(periodicSyncIntervalId);
                periodicSyncIntervalId = null;
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
