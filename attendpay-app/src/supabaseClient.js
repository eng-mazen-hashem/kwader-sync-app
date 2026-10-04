import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '⚠️ Supabase credentials missing. Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to .env'
    );
}

/**
 * Custom storage handler to support "Remember Me"
 * If persistence is 'local', it uses localStorage
 * If persistence is 'session', it uses sessionStorage
 */
const customStorage = {
    getItem: (key) => {
        try {
            return localStorage.getItem(key) || sessionStorage.getItem(key);
        } catch {
            return null;
        }
    },
    setItem: (key, value) => {
        try {
            // Always preserve in localStorage for reliable session recovery across navigation
            localStorage.setItem(key, value);
            sessionStorage.setItem(key, value);
        } catch (e) {
            console.warn('Storage setItem notice:', e);
        }
    },
    removeItem: (key) => {
        try { localStorage.removeItem(key); } catch {}
        try { sessionStorage.removeItem(key); } catch {}
        try { localStorage.removeItem('kwader_auth_persistence'); } catch {}
    }
};

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            storage: customStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);

/**
 * Updates the authentication persistence mode
 * @param {boolean} remember - If true, uses localStorage, otherwise sessionStorage
 */
export const setAuthPersistence = (remember) => {
    try {
        if (remember !== false) {
            localStorage.setItem('kwader_auth_persistence', 'local');
            window._authPersistence = 'local';
        } else {
            localStorage.setItem('kwader_auth_persistence', 'local');
            window._authPersistence = 'local';
        }
    } catch {}
};

