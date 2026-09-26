require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { useCloudAuthState } = require('./cloudAuthState');

async function testCloudAuth() {
    console.log('🧪 Starting Cloud Auth State Adapter Verification...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const channelId = process.env.DEFAULT_CHANNEL_ID;
    const encKey = process.env.SESSION_ENCRYPTION_KEY;

    if (!supabaseUrl || !supabaseKey || !channelId || !encKey) {
        throw new Error('Missing environment configuration in .env');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized.');

    console.log(`📡 Initializing useCloudAuthState for channel: ${channelId}`);
    const { state, saveCreds } = await useCloudAuthState(supabase, channelId, encKey);

    console.log('🔑 Creds initialized, noiseKey exists:', !!state.creds.noiseKey);
    
    // Test saveCreds
    console.log('💾 Testing saveCreds()...');
    await saveCreds();
    console.log('✅ saveCreds() succeeded!');

    // Test writing Signal key
    console.log('📝 Testing keys.set() with mock Signal key...');
    const testBuffer = Buffer.from('test-signal-key-payload-12345');
    await state.keys.set({
        'pre-key': {
            'mock-id-999': {
                keyPair: {
                    public: testBuffer,
                    private: testBuffer
                }
            }
        }
    });
    console.log('✅ keys.set() succeeded!');

    // Test reading Signal key back
    console.log('🔍 Testing keys.get() batch fetch...');
    const retrieved = await state.keys.get('pre-key', ['mock-id-999', 'non-existent-id']);
    
    if (!retrieved['mock-id-999']) {
        throw new Error('Retrieved key is null!');
    }

    const retrievedPub = retrieved['mock-id-999'].keyPair.public;
    if (Buffer.compare(retrievedPub, testBuffer) !== 0) {
        throw new Error('Buffer mismatch between saved and retrieved key!');
    }
    console.log('✅ keys.get() verified: Exact buffer match!');
    console.log('   Non-existent key correctly returned:', retrieved['non-existent-id']);

    // Test deletion
    console.log('🗑️ Testing key deletion via keys.set(null)...');
    await state.keys.set({
        'pre-key': {
            'mock-id-999': null
        }
    });
    const afterDelete = await state.keys.get('pre-key', ['mock-id-999']);
    if (afterDelete['mock-id-999'] !== null) {
        throw new Error('Key was not deleted!');
    }
    console.log('✅ Key deletion verified successfully!');

    // Verify row in database
    const { data: dbCreds } = await supabase
        .from('whatsapp_session_keys')
        .select('key_type, key_id, updated_at')
        .eq('channel_id', channelId);
    
    console.log(`📊 Total keys currently in DB for this channel: ${dbCreds.length}`);
    console.log('🎉 ALL CLOUD AUTH STATE CHECKS PASSED 100%!');
}

testCloudAuth().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
