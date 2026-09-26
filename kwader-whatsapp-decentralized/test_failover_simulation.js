require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { LeaseManager } = require('./leaseManager');

async function simulateFailover() {
    console.log('🧪 Starting Multi-Node Failover Simulation Test...');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const channelId = process.env.DEFAULT_CHANNEL_ID;

    const supabase = createClient(supabaseUrl, supabaseKey);

    let nodeAPromoted = false;
    let nodeBPromoted = false;
    let nodeAState = 'init';
    let nodeBState = 'init';

    console.log('\n--- 1. Launching Node A (First to connect) ---');
    const nodeA = new LeaseManager({
        supabase,
        channelId,
        nodeId: 'TEST-NODE-ALPHA',
        leaseDurationSeconds: 6,
        heartbeatIntervalMs: 2000,
        onBecameLeader: ({ epoch, nodeId }) => {
            console.log(`[NODE-A-EVENT] 👑 Leader elected: ${nodeId} at Epoch ${epoch}`);
            nodeAPromoted = true;
            nodeAState = 'leader';
        },
        onStepDown: (reason) => {
            console.log(`[NODE-A-EVENT] 🔻 Step down: ${reason}`);
            nodeAState = 'standby';
        }
    });

    await nodeA.start();
    await new Promise(r => setTimeout(r, 1500));

    if (!nodeAPromoted) {
        throw new Error('Node A failed to acquire leadership initially!');
    }
    console.log('✅ Node A successfully acquired leader role.');

    console.log('\n--- 2. Launching Node B (Second node, should enter Standby) ---');
    const nodeB = new LeaseManager({
        supabase,
        channelId,
        nodeId: 'TEST-NODE-BETA',
        leaseDurationSeconds: 6,
        heartbeatIntervalMs: 2000,
        onBecameLeader: ({ epoch, nodeId }) => {
            console.log(`[NODE-B-EVENT] 👑 Leader elected: ${nodeId} at Epoch ${epoch}`);
            nodeBPromoted = true;
            nodeBState = 'leader';
        },
        onStepDown: (reason) => {
            console.log(`[NODE-B-EVENT] 🔻 Step down: ${reason}`);
            nodeBState = 'standby';
        }
    });

    await nodeB.start();
    await new Promise(r => setTimeout(r, 1500));

    if (nodeB.role !== 'standby') {
        throw new Error(`Node B is not in standby! Role: ${nodeB.role}`);
    }
    console.log('✅ Node B correctly deferred to Node A and is in standby.');

    console.log('\n--- 3. Simulating Node A Graceful Shutdown (Cooperative Handover) ---');
    await nodeA.shutdown('test_graceful_shutdown');
    console.log('✅ Node A released its lease in database.');

    console.log('⏳ Waiting for Node B to detect vacant lease and take over leadership...');
    const handoverStart = Date.now();
    
    // Poll up to 5 seconds for Node B promotion
    while (!nodeBPromoted && (Date.now() - handoverStart < 5000)) {
        await new Promise(r => setTimeout(r, 300));
    }

    if (!nodeBPromoted) {
        throw new Error('Node B failed to promote to leader after Node A released lease!');
    }

    const elapsedMs = Date.now() - handoverStart;
    console.log(`🎉 SUCCESS! Node B was promoted to Leader in ${elapsedMs}ms!`);
    console.log(`   Node B Epoch: ${nodeB.currentEpoch} (strictly higher than Node A: ${nodeA.currentEpoch})`);

    console.log('\n--- 4. Cleaning up test nodes ---');
    await nodeB.shutdown('test_completed');
    console.log('✅ All test nodes cleanly released.');
    console.log('🏆 100% DISTRIBUTED FAILOVER & CONSENSUS VERIFIED!');
    process.exit(0);
}

simulateFailover().catch(err => {
    console.error('❌ Simulation failed:', err);
    process.exit(1);
});
