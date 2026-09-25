const { proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { encrypt, decrypt } = require('./encryption');

/**
 * Creates a Baileys-compliant AuthenticationState backed by PostgreSQL (Supabase)
 * Stored in whatsapp_session_keys with AES-256-GCM encryption.
 * 
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client with service_role or adequate privileges
 * @param {string} channelId - Channel UUID
 * @param {string} encryptionKey - Symmetric encryption secret
 * @returns {Promise<{ state: import('@whiskeysockets/baileys').AuthenticationState, saveCreds: () => Promise<void> }>}
 */
async function useCloudAuthState(supabase, channelId, encryptionKey) {
    if (!channelId) throw new Error('channelId is required for useCloudAuthState');
    if (!encryptionKey) throw new Error('encryptionKey is required for useCloudAuthState');

    // 1. Read single key by type and id
    const readKey = async (type, id) => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_session_keys')
                .select('key_data')
                .eq('channel_id', channelId)
                .eq('key_type', type)
                .eq('key_id', id)
                .maybeSingle();

            if (error || !data || !data.key_data) {
                return null;
            }

            const decryptedStr = decrypt(data.key_data, encryptionKey);
            if (!decryptedStr) return null;
            return JSON.parse(decryptedStr, BufferJSON.reviver);
        } catch (err) {
            console.error(`[cloudAuthState] Error reading key ${type}:${id}`, err.message);
            return null;
        }
    };

    // 2. Read multiple keys in a single batch query for ultra-fast session hydration
    const readKeysBatch = async (type, ids) => {
        const result = {};
        if (!ids || ids.length === 0) return result;

        try {
            const { data, error } = await supabase
                .from('whatsapp_session_keys')
                .select('key_id, key_data')
                .eq('channel_id', channelId)
                .eq('key_type', type)
                .in('key_id', ids);

            if (error) {
                console.error(`[cloudAuthState] Error in readKeysBatch ${type}:`, error.message);
            }

            const foundMap = new Map();
            if (data) {
                for (const row of data) {
                    try {
                        const decryptedStr = decrypt(row.key_data, encryptionKey);
                        if (decryptedStr) {
                            let parsed = JSON.parse(decryptedStr, BufferJSON.reviver);
                            if (type === 'app-state-sync-key' && parsed) {
                                parsed = proto.Message.AppStateSyncKeyData.fromObject(parsed);
                            }
                            foundMap.set(row.key_id, parsed);
                        }
                    } catch (e) {
                        console.error(`[cloudAuthState] Failed parsing key ${type}:${row.key_id}`, e.message);
                    }
                }
            }

            for (const id of ids) {
                result[id] = foundMap.get(id) || null;
            }
        } catch (err) {
            console.error(`[cloudAuthState] Batch read failed for ${type}:`, err.message);
            for (const id of ids) result[id] = null;
        }

        return result;
    };

    // 3. Write / Delete batch of keys
    const writeKeysBatch = async (updates) => {
        const toUpsert = [];
        const toDeleteIdsByType = {};

        for (const category in updates) {
            for (const id in updates[category]) {
                const value = updates[category][id];
                if (value) {
                    const serialized = JSON.stringify(value, BufferJSON.replacer);
                    const encrypted = encrypt(serialized, encryptionKey);
                    toUpsert.push({
                        channel_id: channelId,
                        key_type: category,
                        key_id: id,
                        key_data: encrypted,
                        updated_at: new Date().toISOString()
                    });
                } else {
                    if (!toDeleteIdsByType[category]) toDeleteIdsByType[category] = [];
                    toDeleteIdsByType[category].push(id);
                }
            }
        }

        const promises = [];

        if (toUpsert.length > 0) {
            // Upsert in chunks of 100 to avoid payload size limits
            const CHUNK_SIZE = 100;
            for (let i = 0; i < toUpsert.length; i += CHUNK_SIZE) {
                const chunk = toUpsert.slice(i, i + CHUNK_SIZE);
                promises.push(
                    supabase
                        .from('whatsapp_session_keys')
                        .upsert(chunk, { onConflict: 'channel_id,key_type,key_id' })
                );
            }
        }

        for (const type in toDeleteIdsByType) {
            const ids = toDeleteIdsByType[type];
            if (ids.length > 0) {
                promises.push(
                    supabase
                        .from('whatsapp_session_keys')
                        .delete()
                        .eq('channel_id', channelId)
                        .eq('key_type', type)
                        .in('key_id', ids)
                );
            }
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }
    };

    // Load initial creds or generate new
    const rawCreds = await readKey('creds', 'default');
    const creds = rawCreds || initAuthCreds();

    const saveCreds = async () => {
        const serialized = JSON.stringify(creds, BufferJSON.replacer);
        const encrypted = encrypt(serialized, encryptionKey);
        
        const { error } = await supabase
            .from('whatsapp_session_keys')
            .upsert({
                channel_id: channelId,
                key_type: 'creds',
                key_id: 'default',
                key_data: encrypted,
                updated_at: new Date().toISOString()
            }, { onConflict: 'channel_id,key_type,key_id' });

        if (error) {
            console.error('[cloudAuthState] Failed to save creds:', error.message);
            throw error;
        }
    };

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    return await readKeysBatch(type, ids);
                },
                set: async (data) => {
                    await writeKeysBatch(data);
                }
            }
        },
        saveCreds
    };
}

module.exports = {
    useCloudAuthState
};
