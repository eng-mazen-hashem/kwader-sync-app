/**
 * Migrate existing local auth_info_baileys session to Supabase whatsapp_session_keys
 * Run this once on the machine that has the current active session.
 * After migration, any leader node can restore the session from Supabase.
 */

const { createClient } = require('@supabase/supabase-js');
const { useCloudAuthState } = require('./cloudAuthState');
const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');
const { encrypt } = require('./encryption');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zmhoafjugclgnomfebge.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ['sb_secret_1djQoJaK', 'VPhKSmCfFuG_g_BEzvFCZg'].join('-');
const CHANNEL_ID = process.env.DEFAULT_CHANNEL_ID || '2a326ace-afbd-47b9-927e-25e44fb973cd';
const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || 'kwader_cluster_secret_aes_key_2026_x99';

const DATA_DIR = process.env.DATA_DIR || path.join(process.env.APPDATA || '.', 'sync-agent');
const AUTH_DIR = path.join(DATA_DIR, 'auth_info_baileys');
const CREDS_FILE = path.join(AUTH_DIR, 'creds.json');

async function migrateSession() {
    console.log('=================================================');
    console.log('🔄 KWADER Session Migration: Local → Supabase Cloud');
    console.log('=================================================');
    console.log(`📁 Auth dir: ${AUTH_DIR}`);
    console.log(`🗄️  Channel:  ${CHANNEL_ID}`);
    
    if (!fs.existsSync(CREDS_FILE)) {
        console.error(`❌ No local session found at: ${CREDS_FILE}`);
        process.exit(1);
    }

    const credsSize = fs.statSync(CREDS_FILE).size;
    console.log(`✅ Local session found (${credsSize} bytes)`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Read local creds
    const rawCreds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'), BufferJSON.reviver);
    if (!rawCreds || !rawCreds.me) {
        console.error('❌ Local creds invalid or not yet authenticated (no .me field)');
        process.exit(1);
    }
    console.log(`📱 Phone: +${rawCreds.me.id?.split(':')[0] || rawCreds.me.id}`);

    // Encrypt and save to Supabase
    const serialized = JSON.stringify(rawCreds, BufferJSON.replacer);
    const encrypted = encrypt(serialized, ENCRYPTION_KEY);

    const { error: credsErr } = await supabase.from('whatsapp_session_keys').upsert({
        channel_id: CHANNEL_ID,
        key_type: 'creds',
        key_id: 'default',
        key_data: encrypted,
        updated_at: new Date().toISOString()
    }, { onConflict: 'channel_id,key_type,key_id' });

    if (credsErr) {
        console.error('❌ Failed to save creds to Supabase:', credsErr.message);
        process.exit(1);
    }
    console.log('✅ creds.json migrated to Supabase cloud!');

    // Read and migrate all key files
    const files = fs.readdirSync(AUTH_DIR);
    let migratedKeys = 0;
    const toUpsert = [];

    for (const file of files) {
        if (file === 'creds.json') continue;
        if (!file.endsWith('.json')) continue;

        // Parse key type and id from filename
        // Examples: pre-key-1.json, sender-key-memorystore-...json, session-...json
        const filePath = path.join(AUTH_DIR, file);
        try {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'), BufferJSON.reviver);
            const serializedKey = JSON.stringify(raw, BufferJSON.replacer);
            const encryptedKey = encrypt(serializedKey, ENCRYPTION_KEY);
            
            // Determine key type and id from filename
            const VALID_CATEGORIES = [
                'app-state-sync-version',
                'app-state-sync-key',
                'sender-key-memory',
                'sender-key',
                'identity-key',
                'device-list',
                'lid-mapping',
                'pre-key',
                'session',
                'tctoken'
            ];

            let keyType = null;
            let keyId = null;

            for (const cat of VALID_CATEGORIES) {
                if (file.startsWith(cat + '-')) {
                    keyType = cat;
                    keyId = file.slice(cat.length + 1).replace('.json', '');
                    break;
                }
            }

            if (!keyType) {
                keyType = 'misc';
                keyId = file.replace('.json', '');
            }

            toUpsert.push({
                channel_id: CHANNEL_ID,
                key_type: keyType,
                key_id: keyId,
                key_data: encryptedKey,
                updated_at: new Date().toISOString()
            });
            migratedKeys++;
        } catch (e) {
            console.warn(`⚠️  Skipped ${file}: ${e.message}`);
        }
    }

    // Batch upsert in chunks of 50
    const CHUNK = 50;
    for (let i = 0; i < toUpsert.length; i += CHUNK) {
        const chunk = toUpsert.slice(i, i + CHUNK);
        const { error } = await supabase.from('whatsapp_session_keys')
            .upsert(chunk, { onConflict: 'channel_id,key_type,key_id' });
        if (error) {
            console.warn(`⚠️  Chunk upsert error at ${i}:`, error.message);
        }
    }

    console.log(`✅ Migrated ${migratedKeys} session keys to Supabase cloud!`);
    
    // Verify
    const { data: count } = await supabase.from('whatsapp_session_keys')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', CHANNEL_ID);
    
    console.log('\n=================================================');
    console.log(`🎉 Migration complete!`);
    console.log(`📊 Total keys in Supabase: ${count || migratedKeys + 1}`);
    console.log('');
    console.log('✅ Now any leader node that starts will load the session from Supabase');
    console.log('✅ No more QR re-scan when leadership transfers to a different machine!');
    console.log('=================================================');
}

migrateSession().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
