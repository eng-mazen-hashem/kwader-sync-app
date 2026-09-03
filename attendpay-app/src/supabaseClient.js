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
        return localStorage.getItem(key) || sessionStorage.getItem(key);
    },
    setItem: (key, value) => {
        const persistence = localStorage.getItem('kwader_auth_persistence') || window._authPersistence || 'local';
        if (persistence === 'local') {
            localStorage.setItem(key, value);
        } else {
            sessionStorage.setItem(key, value);
        }
    },
    removeItem: (key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
        localStorage.removeItem('kwader_auth_persistence');
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
    if (remember) {
        localStorage.setItem('kwader_auth_persistence', 'local');
        window._authPersistence = 'local';
    } else {
        localStorage.removeItem('kwader_auth_persistence');
        window._authPersistence = 'session';
    }
};

