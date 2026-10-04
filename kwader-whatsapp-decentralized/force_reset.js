const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'd:\\Zk att project\\kwader-whatsapp-decentralized\\.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixGhostNodesAndLeases() {
    console.log("Resetting all channels to allow fresh connections...");
    
    // 1. Clear all active leaders to force a new election
    const { error: chErr } = await supabase
        .from('whatsapp_channels')
        .update({
            active_leader_id: null,
            active_node_id: null,
            status: 'disconnected',
            qr_code: null,
            phone_number: null,
            lease_expires_at: null
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // match all

    if (chErr) {
        console.error("Error resetting channels:", chErr);
    } else {
        console.log("Channels reset successfully.");
    }
    
    // 2. Clear session keys to force fresh QR scan
    const { error: sessErr } = await supabase
        .from('whatsapp_session_keys')
        .delete()
        .neq('channel_id', '00000000-0000-0000-0000-000000000000');
        
    if (sessErr) {
        console.error("Error clearing sessions:", sessErr);
    } else {
        console.log("Cloud sessions cleared successfully. Devices will need to scan QR again.");
    }

    // 3. Delete ghost nodes (older than 3 minutes)
    const threeMinsAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { error: nodesErr } = await supabase
        .from('whatsapp_nodes')
        .delete()
        .lt('last_seen', threeMinsAgo);
        
    if (nodesErr) {
        console.error("Error cleaning ghost nodes:", nodesErr);
    } else {
        console.log("Ghost nodes cleared successfully.");
    }
}

fixGhostNodesAndLeases();
