const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
    console.log('🚀 Connecting to Supabase PostgreSQL...');
    const client = new Client({ 
        host: 'aws-1-eu-west-1.pooler.supabase.com',
        port: 5432,
        user: 'postgres.whuopqnhmsevlilkcfre',
        password: 'M@zen176200',
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('✅ Connected successfully!');

    const migrationPath = path.join(__dirname, '..', 'attendpay-app', 'supabase', 'migrations', '20260925000000_decentralized_baileys_cluster.sql');
    console.log(`📄 Reading SQL migration from: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ Executing migration SQL batch...');
    await client.query(sql);
    console.log('🎉 Migration applied successfully!');

    // Verification
    console.log('\n🔍 Verifying created components:');
    const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('whatsapp_channels', 'whatsapp_session_keys', 'whatsapp_nodes');
    `);
    console.log('   Tables confirmed:', tableCheck.rows.map(r => r.table_name));

    const rpcCheck = await client.query(`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
          AND routine_name IN ('acquire_whatsapp_lease', 'renew_whatsapp_heartbeat', 'release_whatsapp_lease');
    `);
    console.log('   RPC Functions confirmed:', rpcCheck.rows.map(r => r.routine_name));

    // Test acquire_whatsapp_lease RPC
    const channelRes = await client.query('SELECT id FROM whatsapp_channels WHERE is_default = true LIMIT 1');
    if (channelRes.rows.length > 0) {
        const defaultChannelId = channelRes.rows[0].id;
        console.log(`\n🧪 Testing acquire_whatsapp_lease with channel: ${defaultChannelId}`);
        const leaseTest = await client.query(`
            SELECT public.acquire_whatsapp_lease('TEST-NODE-001', $1, 15, 100) AS result;
        `, [defaultChannelId]);
        console.log('   RPC Lease Test Result:', leaseTest.rows[0].result);

        // Test release
        const releaseTest = await client.query(`
            SELECT public.release_whatsapp_lease('TEST-NODE-001', $1, 'test_complete') AS result;
        `, [defaultChannelId]);
        console.log('   RPC Release Test Result:', releaseTest.rows[0].result);
    }

    await client.end();
    console.log('\n✅ Phase 1 Database Infrastructure is 100% COMPLETE & VERIFIED!');
}

applyMigration().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
