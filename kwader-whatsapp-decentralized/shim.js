// Polyfill for Node 18 environments (used by pkg)

// 1. Diagnostics Channel
const dc = require('diagnostics_channel');
if (dc && !dc.tracingChannel) {
    dc.tracingChannel = function(name) {
        const dummyChannel = { hasSubscribers: false, publish: () => {} };
        const ch = (typeof dc.channel === 'function') ? dc.channel(name) : dummyChannel;
        return {
            name,
            hasSubscribers: false,
            subscribe: () => {},
            unsubscribe: () => {},
            traceSync: (fn) => fn(),
            tracePromise: (fn) => fn(),
            start: ch,
            end: ch,
            asyncStart: ch,
            asyncEnd: ch,
            error: ch,
        };
    };
}

// 2. WebCrypto (globalThis.crypto and subtle)
const nodeCrypto = require('crypto');
if (!globalThis.crypto) {
    globalThis.crypto = nodeCrypto.webcrypto;
}
if (globalThis.crypto && !globalThis.crypto.subtle && nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle) {
    globalThis.crypto.subtle = nodeCrypto.webcrypto.subtle;
}

// 3. Native WebSocket for Supabase Realtime / Baileys in Node 18
try {
    const WebSocket = require('ws');
    if (!globalThis.WebSocket) {
        globalThis.WebSocket = WebSocket;
    }
} catch (e) {}
