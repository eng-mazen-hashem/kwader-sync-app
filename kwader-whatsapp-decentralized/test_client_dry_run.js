require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { initWhatsAppClient } = require('./whatsappClient');

async function dryRunTest() {
    console.log('🧪 Starting WhatsApp Client Dry-Run Initialization Test...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const channelId = process.env.DEFAULT_CHANNEL_ID;
    const encKey = process.env.SESSION_ENCRYPTION_KEY;

    const supabase = createClient(supabaseUrl, supabaseKey);

    let qrReceived = false;

    console.log('⚡ Initializing Baileys client instance...');
    const client = await initWhatsAppClient({
        channelId,
        supabase,
        encryptionKey: encKey,
        onQr: (dataUrl) => {
            console.log('📸 QR Code received! Length:', dataUrl.length);
            qrReceived = true;
            // Clean up and disconnect immediately for dry-run
            client.disconnect();
            console.log('✅ Client successfully disconnected after QR capture.');
            process.exit(0);
        },
        onConnected: (sock) => {
            console.log('✅ Client connected!');
            client.disconnect();
            process.exit(0);
        }
    });

    console.log('⏳ Waiting up to 15s for initial QR or connection event...');
    setTimeout(() => {
        console.log('⏱️ Dry-run timeout reached, shutting down test.');
        client.disconnect();
        process.exit(0);
    }, 15000);
}

dryRunTest().catch(err => {
    console.error('❌ Dry-run test failed:', err);
    process.exit(1);
});
