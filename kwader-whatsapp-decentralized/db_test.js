const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'd:\\Zk att project\\kwader-whatsapp-decentralized\\.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Checking channels...");
    const { data: channels, error: channelsErr } = await supabase.from('whatsapp_channels').select('*');
    if (channelsErr) {
        console.error("Channels error:", channelsErr);
        return;
    }
    console.log("Channels:", channels);

    console.log("Checking nodes...");
    const { data: nodes, error: nodesErr } = await supabase.from('whatsapp_nodes').select('*');
    if (nodesErr) {
        console.error("Nodes error:", nodesErr);
        return;
    }
    console.log("Nodes:", nodes);
    
    // Also test acquiring lease
    console.log("Testing acquire_whatsapp_lease...");
    const { data: leaseData, error: leaseErr } = await supabase.rpc('acquire_whatsapp_lease', {
        p_node_id: 'test_node_123',
        p_channel_id: '2a326ace-afbd-47b9-927e-25e44fb973cd',
        p_lease_duration_seconds: 30,
        p_health_score: 100
    });
    console.log("Lease result:", { data: leaseData, error: leaseErr });
}

main().catch(console.error);
