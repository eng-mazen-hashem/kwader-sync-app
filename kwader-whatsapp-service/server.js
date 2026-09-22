/**
 * ============================================================
 * KWADER WhatsApp Node Agent - v2.0 (Decentralized)
 * ============================================================
 *
 * Architecture: Distributed Leader Election + Message Queue
 *
 * - يعمل هذا السكريبت على أجهزة العملاء في الخلفية (Background Process)
 * - يتنافس العملاء على "القفل" (Lock) في Supabase
 * - الفائز بالقفل (LEADER) يصبح هو المسؤول عن إرسال الرسائل
 * - باقي العملاء يدخلون في وضع (STANDBY) ويراقبون القفل
 * - إذا انقطع القائد، يستحوذ أول عميل في الاستعداد على القفل تلقائياً
 * - لا يوجد HTTP Server أو Port مفتوح — فقط استماع لـ Supabase Realtime
 * ============================================================
 */

require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { handleIncomingWhatsAppMessage } = require('./ai/aiOrchestrator');
const https = require('https');

// ============================================================
// GITHUB PRIVATE REPO SESSION SYNC & AES-256 ENCRYPTION
// ============================================================
const GITHUB_SESSION_REPO = process.env.GITHUB_SESSION_REPO || 'eng-mazen-hashem/whatsapp-kwader';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

function getEncryptionKey() {
    const secret = process.env.SESSION_SECRET || (typeof SUPABASE_KEY !== 'undefined' ? SUPABASE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY) || 'kwader-whatsapp-secret-key-salt';
    return crypto.createHash('sha256').update(secret).digest();
}

function encryptBuffer(buffer) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
}

function decryptBuffer(encryptedBuffer) {
    const key = getEncryptionKey();
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const ciphertext = encryptedBuffer.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function githubApiRequest(urlPath, method = 'GET', body = null, token = GITHUB_TOKEN, headers = {}) {
    return new Promise((resolve) => {
        if (!token || typeof token !== 'string' || !token.trim()) {
            return resolve({ status: 401, error: 'No GitHub token provided' });
        }
        try {
            const fullUrl = urlPath.startsWith('http') ? urlPath : `https://api.github.com${urlPath}`;
            const u = new URL(fullUrl);
            const reqHeaders = {
                'User-Agent': 'KWADER-WhatsApp-Node',
                ...headers
            };
            if (token && (u.hostname === 'api.github.com' || u.hostname === 'uploads.github.com')) {
                reqHeaders['Authorization'] = `token ${token}`;
            }
            let payloadBuf = null;
            if (body) {
                if (Buffer.isBuffer(body)) {
                    payloadBuf = body;
                } else if (typeof body === 'string') {
                    payloadBuf = Buffer.from(body, 'utf8');
                } else {
                    payloadBuf = Buffer.from(JSON.stringify(body), 'utf8');
                    if (!reqHeaders['Content-Type']) reqHeaders['Content-Type'] = 'application/json';
                }
                if (!reqHeaders['Content-Length']) {
                    reqHeaders['Content-Length'] = payloadBuf.length;
                }
            }

            const req = https.request({
                hostname: u.hostname,
                path: u.pathname + u.search,
                method,
                headers: reqHeaders,
                timeout: 8000
            }, res => {
                if (res.statusCode === 302 || res.statusCode === 301) {
                    return resolve(githubApiRequest(res.headers.location, 'GET', null, token, headers));
                }
                let chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => {
                    const buf = Buffer.concat(chunks);
                    try {
                        resolve({ status: res.statusCode, data: JSON.parse(buf.toString()), raw: buf });
                    } catch(e) {
                        resolve({ status: res.statusCode, raw: buf });
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy(new Error('GitHub API request timed out (8s)'));
                resolve({ status: 408, error: 'Request Timeout (8s)' });
            });

            req.on('error', (err) => {
                resolve({ status: 500, error: err.message });
            });

            if (payloadBuf) req.write(payloadBuf);
            req.end();
        } catch (e) {
            resolve({ status: 500, error: e.message });
        }
    });
}

const EXCLUDE_SESSION_PATTERNS = [
    'Cache',
    'Code Cache',
    'GPUCache',
    'Crashpad',
    'BrowserMetrics',
    'WasmTtsEngine',
    'component_crx_cache',
    'OnDeviceHeadSuggestModel',
    'OptimizationGuideModelStore',
    'Service Worker',
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket'
];

function addFolderFilteredToZip(zip, dirPath, zipFolderPath = '') {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = zipFolderPath ? path.join(zipFolderPath, entry.name) : entry.name;
        const normalizedRel = relPath.replace(/\\/g, '/');
        if (EXCLUDE_SESSION_PATTERNS.some(pat => normalizedRel.includes(pat))) {
            continue;
        }
        if (entry.isDirectory()) {
            addFolderFilteredToZip(zip, fullPath, relPath);
        } else {
            try {
                const fileData = fs.readFileSync(fullPath);
                zip.addFile(normalizedRel, fileData);
            } catch (e) {
                // ignore transient locked files
            }
        }
    }
}

// ============================================================
// GLOBAL ERROR HANDLING
// ============================================================
process.on('uncaughtException', (err) => {
    console.error(new Date().toISOString(), '[GLOBAL_ERROR] Uncaught Exception:', err.message);
    if (err.message && err.message.includes('EBUSY: resource busy or locked')) {
        console.warn('⚠️  Ignored EBUSY lockfile error. Continuing execution...');
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(new Date().toISOString(), '[GLOBAL_ERROR] Unhandled Rejection:', reason);
});

// ============================================================
// BROWSER DETECTION
// ============================================================
function findBrowser() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    if (process.platform !== 'win32') return undefined;
    
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    if (process.env.LOCALAPPDATA) {
        paths.push(path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'));
        paths.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return undefined;
}

// تنظيف أقفال كروميوم القديمة والعمليات المعلقة لمنع تجميد أو تعطل المتصفح عند الإقلاع
function cleanChromiumLocks(targetDir) {
    try {
        if (!targetDir) return;

        // 1. إنهاء أي عمليات كروم معلقة تخص هذا المجلد
        if (process.platform === 'win32') {
            try {
                const { execSync } = require('child_process');
                const escapedDir = targetDir.replace(/\\/g, '\\\\').replace(/"/g, '');
                execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name='chrome.exe'\\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*${escapedDir}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, {
                    stdio: 'ignore',
                    timeout: 4000,
                    windowsHide: true
                });
            } catch (e) {}
        }

        if (!fs.existsSync(targetDir)) return;
        const lockFileNames = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort'];
        function scanAndPurge(dirPath, depth = 0) {
            if (depth > 3) return;
            try {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    if (entry.isDirectory()) {
                        scanAndPurge(fullPath, depth + 1);
                    } else if (lockFileNames.includes(entry.name)) {
                        try {
                            fs.unlinkSync(fullPath);
                            log('INFO', `🧹 تم إزالة ملف القفل القديم لكروميوم: ${entry.name}`);
                        } catch (e) {
                            // ignore EBUSY
                        }
                    }
                }
            } catch (e) {}
        }
        scanAndPurge(targetDir);
    } catch (e) {}
}

// فحص حيوية واستجابة عميل الواتساب في الخلفية لمنع القائد الزومبي (Liveness Probe)
let connectingStartTime = null;
let isWhatsAppAuthenticated = false;
let sessionKnownCorrupted   = false; // ✅ يكون true فقط عند فشل تحقق حقيقي (auth_failure/LOGOUT) وليس عند كل انقطاع

async function checkWhatsAppLiveness() {
    // إذا لم يكن العميل موجوداً بعد
    if (!waClient) {
        // إذا كنا نحاول الاتصال وتجاوزنا 60 ثانية بدون إنشاء العميل
        if (connectingStartTime && (Date.now() - connectingStartTime > 60_000)) {
            log('WARN', '⚠️ تجاوزت العقدة مهلة تهيئة عميل الواتساب (60 ثانية) دون إطلاق المتصفح.');
            return false;
        }
        // في بداية الإقلاع نعتبرها حية طالما لم تنته المهلة
        return true;
    }

    if (!waClient.pupPage || waClient.pupPage.isClosed()) return false;
    
    // إذا تمت المصادقة بنجاح والعميل قيد مزامنة الرسائل وتحميل المحادثات (بين authenticated و ready)
    if (isWhatsAppAuthenticated && !waClient.info) {
        return true;
    }

    // إذا لم تكتمل المصادقة بعد (في انتظار مسح رمز الـ QR)، فالمتصفح وصفحة الواتساب تعمل بنجاح
    if (!waClient.info) {
        if (!connectingStartTime) connectingStartTime = Date.now();
        const waitingSeconds = Math.round((Date.now() - connectingStartTime) / 1000);
        // حماية: إذا مرت أكثر من 10 دقائق في انتظار مسح الـ QR دون استجابة، نعتبر العملية معلقة
        if (waitingSeconds > 600) {
            log('WARN', '⚠️ تجاوزت العقدة مهلة انتظار مسح رمز الـ QR (10 دقائق). التنازل التلقائي عن القفل لمنع احتكار القناة...');
            return false;
        }
        return true;
    }

    connectingStartTime = null;
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 6000)
        );
        const statePromise = waClient.getState();
        const state = await Promise.race([statePromise, timeoutPromise]);
        return state === 'CONNECTED' || typeof state === 'string';
    } catch (err) {
        return false;
    }
}

// ============================================================
// CONFIGURATION & ENTERPRISE NODE IDENTITY
// ============================================================

const APP_VERSION = '2.4.0';

const defaultDataDir = process.env.DATA_DIR || 
    (process.env.APPDATA ? path.join(process.env.APPDATA, 'sync-agent') : __dirname);
const baseDataDir = defaultDataDir;
try {
    if (!fs.existsSync(baseDataDir)) {
        fs.mkdirSync(baseDataDir, { recursive: true });
    }
} catch (e) {}

// تحميل .env من مجلد البيانات في حال وجوده مع تخطي المتغيرات القديمة
const localDataEnv = path.join(baseDataDir, '.env');
if (fs.existsSync(localDataEnv)) {
    require('dotenv').config({ path: localDataEnv, override: true });
}

let SUPABASE_URL = process.env.SUPABASE_URL || 'https://whuopqnhmsevlilkcfre.supabase.co';
if (SUPABASE_URL.includes('bpmbtursvnkdmnybzvrm')) {
    SUPABASE_URL = 'https://whuopqnhmsevlilkcfre.supabase.co';
}

let SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY || SUPABASE_KEY.includes('bpmbtursvnkdmnybzvrm')) {
    SUPABASE_KEY = Buffer.from('c2Jfc2VjcmV0X0tCeW1oQ25RRW1WOTMyQ0J3R0tTVWdfcUZHZDJYTmo=', 'base64').toString('utf8');
}

// ✅ إصلاح #1: مزامنة اسم الشركة الصحيح من السحابة عند الإقلاع لمنع NODE_ID الخاطئ
async function syncCompanyNameFromCloud(baseDir) {
    try {
        const settingsFile = path.join(baseDir, 'settings.json');
        let settings = {};
        try {
            if (fs.existsSync(settingsFile)) {
                settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            }
        } catch (e) { return; }

        const licenseKey = settings.licenseKey;
        if (!licenseKey) return; // لا يوجد ترخيص — لا شيء نفعله

        // استرداد بيانات الشركة الحقيقية من Supabase
        const { createClient: _createClient } = require('@supabase/supabase-js');
        const _sb = _createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
        const { data, error } = await _sb.rpc('check_subscription', { p_license_key: licenseKey });
        if (error || !data || !data.active) {
            console.log('[BOOT] تعذر التحقق من الترخيص أو الترخيص غير فعال. الاستمرار بالإعدادات المحلية.');
            return;
        }

        const realCompanyName = (data.company_name || '').trim();
        if (!realCompanyName) return;

        const currentName = (settings.companyName || '').trim();
        if (currentName === realCompanyName) return; // لا تغيير

        console.log(`[BOOT] ⚠️ تم اكتشاف اسم شركة غير متطابق: "${currentName}" → "${realCompanyName}". جارٍ التصحيح التلقائي...`);
        settings.companyName = realCompanyName;
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
        console.log(`[BOOT] ✅ تم تحديث اسم الشركة في settings.json إلى: "${realCompanyName}"`);
    } catch (e) {
        console.warn('[BOOT] تعذر مزامنة اسم الشركة من السحابة:', e.message);
    }
}

if (!process.env.GITHUB_TOKEN) {
    process.env.GITHUB_TOKEN = '';
}
if (!process.env.GITHUB_SESSION_REPO) {
    process.env.GITHUB_SESSION_REPO = 'eng-mazen-hashem/whatsapp-kwader';
}

let CHANNEL_ID = process.env.CHANNEL_ID || null;
let channelFolderSuffix = CHANNEL_ID ? `_${CHANNEL_ID.substring(0, 8)}` : '';

/**
 * Enterprise Deterministic Node Identity Provider:
 * - Primary: Company Name or License Key from settings.json (e.g. "Demo" or "LIC-64c48a3a")
 * - Host: Machine Hostname
 * - Worker Scope: Suffix of channel_id if dedicated worker
 * - Fallback: Persistent Hardware/Host Machine Salt saved in .node_machine_id
 * Guarantees zero ID churn across restarts/reboots.
 */
function resolveDeterministicNodeId(baseDir, channelId) {
    let companyTag = '';
    try {
        const settingsFile = path.join(baseDir, 'settings.json');
        if (fs.existsSync(settingsFile)) {
            const parsed = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            if (parsed.companyName && typeof parsed.companyName === 'string' && parsed.companyName.trim()) {
                companyTag = parsed.companyName.trim();
            } else if (parsed.licenseKey && typeof parsed.licenseKey === 'string' && parsed.licenseKey.trim()) {
                const cleanKey = parsed.licenseKey.replace(/[^a-zA-Z0-9]/g, '');
                companyTag = `LIC-${cleanKey.substring(0, 8)}`;
            }
        }
    } catch (e) {}

    if (companyTag) {
        companyTag = companyTag.replace(/[^\p{L}\p{N}_-]/gu, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    }

    let persistentSalt = '';
    const saltFile = path.join(baseDir, '.node_machine_id');
    try {
        if (fs.existsSync(saltFile)) {
            persistentSalt = fs.readFileSync(saltFile, 'utf8').trim();
        }
        if (!persistentSalt || persistentSalt.length < 4) {
            persistentSalt = crypto.randomBytes(4).toString('hex');
            fs.writeFileSync(saltFile, persistentSalt, 'utf8');
        }
    } catch (e) {
        persistentSalt = 'node';
    }

    const host = os.hostname().replace(/[^\p{L}\p{N}_-]/gu, '_');
    const baseIdentity = companyTag ? `${companyTag}-${host}` : `${host}-${persistentSalt}`;
    return channelId ? `${baseIdentity}-${channelId.substring(0, 8)}` : baseIdentity;
}

// معرف فريد ودائم لهذا الجهاز مبني على الترخيص واسم الكمبيوتر
let NODE_ID = resolveDeterministicNodeId(baseDataDir, CHANNEL_ID);

// المهل الزمنية (بالمللي ثانية)
const HEARTBEAT_INTERVAL_MS  = 25_000;  // 25 ثانية بين كل نبضة حياة
const LOCK_TIMEOUT_MS         = 60_000;  // 60 ثانية — إذا تجاوزها القائد يُعتبر ميتاً
const STANDBY_CHECK_MS        = 30_000;  // ✅ إصلاح 2: تقليل من 45s إلى 30s للاستجابة أسرع عند فشل Realtime
const PENDING_POLL_MS         = 20_000;  // ✅ إصلاح 7: تقليل من 30s إلى 20s لمعالجة الرسائل المتراكمة أسرع
// ✅ إصلاح 5: حماية من تكرار النسخ الاحتياطي في الشبكات المتقطعة
const BACKUP_THROTTLE_MS      = 60 * 60 * 1000; // مرة واحدة كل ساعة كحد أقصى
let lastBackupTime            = 0;

let sessionDir = path.join(baseDataDir, `.wwebjs_auth${channelFolderSuffix}`);
let zipPath    = path.join(baseDataDir, `session_backup${channelFolderSuffix}.zip`);

let lockKey           = CHANNEL_ID ? `whatsapp_lock_${CHANNEL_ID}` : 'whatsapp_lock';
let sessionStorageKey = CHANNEL_ID ? `whatsapp_session_zip_${CHANNEL_ID}` : 'whatsapp_session_zip';
let qrKey             = CHANNEL_ID ? `whatsapp_qr_pending_${CHANNEL_ID}` : 'whatsapp_qr_pending';
let controlCommandKey = CHANNEL_ID ? `whatsapp_control_${CHANNEL_ID}` : 'whatsapp_control_master';

function recomputeChannelVariables(newChannelId) {
    CHANNEL_ID = newChannelId || null;
    channelFolderSuffix = CHANNEL_ID ? `_${CHANNEL_ID.substring(0, 8)}` : '';
    NODE_ID = resolveDeterministicNodeId(baseDataDir, CHANNEL_ID);
    sessionDir = path.join(baseDataDir, `.wwebjs_auth${channelFolderSuffix}`);
    zipPath    = path.join(baseDataDir, `session_backup${channelFolderSuffix}.zip`);
    lockKey           = CHANNEL_ID ? `whatsapp_lock_${CHANNEL_ID}` : 'whatsapp_lock';
    sessionStorageKey = CHANNEL_ID ? `whatsapp_session_zip_${CHANNEL_ID}` : 'whatsapp_session_zip';
    qrKey             = CHANNEL_ID ? `whatsapp_qr_pending_${CHANNEL_ID}` : 'whatsapp_qr_pending';
    controlCommandKey = CHANNEL_ID ? `whatsapp_control_${CHANNEL_ID}` : 'whatsapp_control_master';
}

// ============================================================
// SUPABASE CLIENT
// ============================================================

// Hack to fix Node 18 websocket in supabase-js
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false,
    },
    realtime: { 
        params: { eventsPerSecond: 10 } 
    },
    global: {
        fetch: fetch,
        headers: { 'x-my-custom-header': 'kwader-node' },
    }
});

supabase.realtime.setAuth = supabase.realtime.setAuth.bind(supabase.realtime);

// ============================================================
// STATE
// ============================================================

let isLeader               = false;
let heartbeatTimer         = null;
let standbyTimer           = null;
let pendingPollTimer       = null;
let waClient               = null;
let realtimeChannel        = null;
let settingsChannel        = null;
let isShuttingDown         = false;
let isInitializingWhatsApp = false; // ✅ guard: prevents concurrent initWhatsApp calls

// ============================================================
// LOGGING
// ============================================================

function log(level, ...args) {
    const prefix = {
        INFO:    `[${NODE_ID}] ℹ️ `,
        LEADER:  `[${NODE_ID}] 👑 LEADER | `,
        STANDBY: `[${NODE_ID}] 🟡 STANDBY | `,
        WARN:    `[${NODE_ID}] ⚠️  `,
        ERROR:   `[${NODE_ID}] ❌ `,
        SUCCESS: `[${NODE_ID}] ✅ `,
    };
    console.log(new Date().toISOString(), prefix[level] || '', ...args);
}

// ============================================================
// CHANNEL STATUS HELPER (مزامنة حالة القناة الحية)
// ============================================================

async function updateChannelStatus(status, extra = {}) {
    try {
        const updateData = {
            node_id: NODE_ID,
            active_node_id: NODE_ID,
            updated_at: new Date().toISOString(),
            ...extra
        };
        if (status !== undefined) {
            updateData.status = status;
        }
        if (CHANNEL_ID) {
            await supabase.from('whatsapp_channels').update(updateData).eq('id', CHANNEL_ID);
        } else {
            await supabase.from('whatsapp_channels').update(updateData).eq('is_default', true);
        }
    } catch (err) {
        log('WARN', 'تعذر تحديث جدول whatsapp_channels:', err.message);
    }
}

// جلب إعدادات القناة الحالية لمعرفة حالة الذكاء الاصطناعي
async function getActiveChannelConfig() {
    try {
        let query = supabase.from('whatsapp_channels').select('*');
        if (CHANNEL_ID) {
            query = query.eq('id', CHANNEL_ID);
        } else {
            query = query.eq('is_default', true);
        }
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        return data;
    } catch (err) {
        log('WARN', 'تعذر جلب إعدادات القناة للـ AI:', err.message);
        return null;
    }
}

// ============================================================
// 1. SESSION MANAGEMENT (Warm Standby & Cloud Replication)
// ============================================================

let isSyncingSession = false;

/**
 * مزامنة استباقية للجلسة من GitHub إلى العقد المستعدة (Warm Standby)
 * - تعمل في الخلفية بدون تجميد أو تعطيل العقدة
 * - تقوم بتحميل وفك تشفير وتجهيز الجلسة في sessionDir محلياً
 * - تضمن أن العقدة المستعدة تملك الجلسة مسبقاً وفور وقوع القائد تصبح القائد الجديد دون QR ودون تأخير
 */
async function syncSessionFromCloud(force = false) {
    if (isSyncingSession) {
        log('INFO', '📦 [Warm-Standby] عملية مزامنة الجلسة جارية بالفعل في الخلفية...');
        return false;
    }
    const token = GITHUB_TOKEN;
    const repo = GITHUB_SESSION_REPO;
    if (!token || typeof token !== 'string' || !token.trim() || !repo) return false;

    isSyncingSession = true;
    try {
        const relRes = await githubApiRequest(`/repos/${repo}/releases/tags/whatsapp-session-sync`, 'GET', null, token);
        if (relRes.status !== 200 || !relRes.data?.id) return false;

        const releaseId = relRes.data.id;
        const assetName = `${sessionStorageKey}.enc`;
        const assetsRes = await githubApiRequest(`/repos/${repo}/releases/${releaseId}/assets`, 'GET', null, token);
        const targetAsset = Array.isArray(assetsRes.data) ? assetsRes.data.find(a => a.name === assetName) : null;

        if (!targetAsset) {
            log('INFO', '📦 [Warm-Standby] لا توجد جلسة مرفوعة في GitHub لهذه القناة بعد.');
            return false;
        }

        const sessionVersionFile = path.join(baseDataDir, `.session_ver${channelFolderSuffix}.json`);
        let localVer = null;
        try {
            if (fs.existsSync(sessionVersionFile)) {
                localVer = JSON.parse(fs.readFileSync(sessionVersionFile, 'utf8'));
            }
        } catch (e) {}

        const hasLocalFiles = fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0;

        if (!force && hasLocalFiles && localVer && localVer.asset_id === targetAsset.id && localVer.updated_at === targetAsset.updated_at) {
            log('INFO', '✅ [Warm-Standby] الجلسة المحلية محدثة ومطابقة للنسخة السحابية.');
            return true;
        }

        log('INFO', `📥 [Warm-Standby] جارٍ تحميل وتجهيز الجلسة مسبقاً للعقدة المستعدة (${(targetAsset.size / 1024 / 1024).toFixed(2)} MB)...`);
        const dlRes = await githubApiRequest(`/repos/${repo}/releases/assets/${targetAsset.id}`, 'GET', null, token, {
            'Accept': 'application/octet-stream'
        });

        if (dlRes.status === 200 && dlRes.raw && dlRes.raw.length > 0) {
            log('INFO', '🔐 [Warm-Standby] جارٍ فك تشفير وتثبيت الجلسة في مجلد البيانات المحلي...');
            const decryptedZip = decryptBuffer(dlRes.raw);
            const zip = new AdmZip(decryptedZip);
            cleanChromiumLocks(sessionDir);
            zip.extractAllTo(sessionDir, true);

            try {
                fs.writeFileSync(sessionVersionFile, JSON.stringify({
                    asset_id: targetAsset.id,
                    updated_at: targetAsset.updated_at,
                    synced_at: new Date().toISOString()
                }), 'utf8');
            } catch (e) {}

            log('SUCCESS', '✅ [Warm-Standby] تم تجهيز الجلسة محلياً بنجاح! العقدة مستعدة للاستلام الفوري بدون كود QR وبدون تأخير.');
            return true;
        }
        return false;
    } catch (err) {
        log('WARN', `تعذر مزامنة الجلسة استباقياً للمستعد: ${err.message}`);
        return false;
    } finally {
        isSyncingSession = false;
    }
}

async function restoreSession() {
    try {
        if (fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0) {
            log('SUCCESS', 'تم العثور على جلسة الواتساب محلياً في مجلد البيانات (Zero-Egress Cache).');
            return true;
        }

        if (GITHUB_TOKEN && GITHUB_TOKEN.trim() && GITHUB_SESSION_REPO) {
            log('INFO', 'جاري البحث عن جلسة واتساب محفوظة في مستودع GitHub الخاص...');
            const restored = await syncSessionFromCloud(true);
            if (restored) return true;
        }

        log('INFO', 'لا توجد جلسة واتساب سابقة محلياً أو سحابياً. سيتم عرض رمز QR لتسجيل الدخول.');
        return false;
    } catch (err) {
        log('ERROR', 'خطأ في فحص الجلسة المحلية:', err.message);
        return false;
    }
}

// تطهير الجلسة المحلية بالكامل لمنع تحميل ملفات ملغاة أو معطوبة
function purgeLocalSession(targetDir) {
    try {
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
            log('INFO', `🧹 تم تطهير مجلد الجلسة المحلي بالكامل: ${targetDir}`);
        }
        const sessionVersionFile = path.join(baseDataDir, `.session_ver${channelFolderSuffix}.json`);
        if (fs.existsSync(sessionVersionFile)) {
            fs.unlinkSync(sessionVersionFile);
        }
    } catch (e) {
        log('WARN', `تعذر تطهير مجلد الجلسة كاملاً: ${e.message}`);
    }
}

let isResettingSession = false;
async function handleSessionLogout(reason) {
    if (isResettingSession) return;
    isResettingSession = true;
    connectingStartTime = null;
    isWhatsAppAuthenticated = false;
    sessionKnownCorrupted = true; // ✅ فساد حقيقي: يجب حذف الجلسة
    log('WARN', `🚨 رصد تسجيل خروج الواتساب أو إلغاء الجلسة! [السبب: ${reason}]`);

    try {
        // 1. تحديث حالة القناة في قاعدة البيانات فوراً وتصفير الرقم والـ QR
        await updateChannelStatus('qr_pending', {
            phone_number: null,
            qr_code: null,
            last_heartbeat: new Date().toISOString()
        });

        // 2. حذف إشارات الجلسة والـ QR القديم من Supabase
        try {
            await supabase.from('system_settings').delete().eq('key', sessionStorageKey);
            await supabase.from('system_settings').delete().eq('key', qrKey);
        } catch (e) {}

        // 3. إنهاء عميل الواتساب الحالي بأمان
        if (waClient) {
            try { await waClient.destroy(); } catch (e) {}
            waClient = null;
        }

        // 4. تطهير الجلسة المحلية وأقفال كروميوم
        purgeLocalSession(sessionDir);
        try {
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        } catch (e) {}
        cleanChromiumLocks(sessionDir);

        // 4.5. حذف الجلسة السحابية الفاسدة من GitHub لتجنب تكرار تنزيلها وتجميد النظام
        if (GITHUB_TOKEN && GITHUB_SESSION_REPO) {
            try {
                log('INFO', '☁️ جاري حذف الجلسة السحابية الفاسدة من GitHub...');
                const relRes = await githubApiRequest(`/repos/${GITHUB_SESSION_REPO}/releases/tags/whatsapp-session-sync`, 'GET', null, GITHUB_TOKEN);
                if (relRes.status === 200 && relRes.data?.id) {
                    await githubApiRequest(`/repos/${GITHUB_SESSION_REPO}/releases/${relRes.data.id}`, 'DELETE', null, GITHUB_TOKEN);
                    log('SUCCESS', '✅ تم حذف الجلسة السحابية الفاسدة من GitHub بنجاح.');
                }
            } catch (e) {
                log('WARN', '⚠️ فشل حذف الجلسة السحابية الفاسدة: ' + e.message);
            }
        }

        // 5. إذا كنا القائد، نعيد التهيئة فوراً بجلسة نظيفة لننتج كود QR جديد للمسؤول!
        if (isLeader && !isShuttingDown) {
            log('INFO', '🔄 إعادة تشغيل العميل بجلسة نظيفة لتوليد رمز QR جديد للمسؤول...');
            setTimeout(async () => {
                if (isLeader && !isShuttingDown) {
                    try {
                        await initWhatsApp();
                    } catch (err) {
                        log('ERROR', 'فشل إعادة تشغيل العميل بعد تسجيل الخروج:', err.message);
                    }
                }
            }, 2000);
        }
    } finally {
        setTimeout(() => { isResettingSession = false; }, 4000);
    }
}

// ============================================================
// 1.5 NODE TELEMETRY (تسجيل العقدة في الشبكة اللامركزية)
// ============================================================

async function updateNodeTelemetry(role = (isLeader ? 'leader' : 'standby')) {
    try {
        const t0 = Date.now();
        const mem = process.memoryUsage();
        const hasSession = fs.existsSync(sessionDir);
        const { error: upsertErr } = await supabase.from('whatsapp_nodes').upsert({
            node_id:          NODE_ID,
            role:             role,
            hostname:         os.hostname(),
            version:          APP_VERSION,
            channel_id:       CHANNEL_ID,
            is_leader:        role === 'leader',
            health_score:     hasSession ? 100 : 75,
            memory_rss_mb:    Math.round(mem.rss / (1024 * 1024)),
            uptime_seconds:   Math.round(process.uptime()),
            response_time_ms: Math.max(12, Date.now() - t0),
            status:           role === 'offline' ? 'offline' : 'online',
            last_seen:        new Date().toISOString()
        }, { onConflict: 'node_id' });
    } catch (e) {
        // Telemetry errors should never interrupt core flow
    }
}

// ============================================================
// 1.6 CLUSTER HOUSEKEEPING (تنظيف العقد الميتة تلقائياً)
// ============================================================

let nodePruneTimer = null;

// ✅ إصلاح #2: تنظيف فوري عند الإقلاع — يمنع ازدواجية العقد في الداشبورد
async function bootCleanupStaleNodes() {
    try {
        // حذف كل السجلات القديمة لنفس hostname مهما كان NODE_ID (إلا السجل الحالي إذا وُجد)
        await supabase
            .from('whatsapp_nodes')
            .delete()
            .eq('hostname', os.hostname())
            .neq('node_id', NODE_ID); // ✅ الحذف الكامل للعقد القديمة بنفس الجهاز

        log('INFO', `🧹 [Boot Cleanup] تم تنظيف العقد القديمة لهذا الجهاز (${os.hostname()}) من الشبكة.`);
    } catch (e) {
        // لا نوقف الإقلاع بسبب فشل التنظيف
    }
}

async function pruneStaleNodes() {
    if (!isLeader || CHANNEL_ID) return; // Only Master leader manages cluster housekeeping
    try {
        // ✅ إصلاح #2: تقليل المهلة من 10 دقائق إلى 3 دقائق لإصلاح ازدواجية العقد
        const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        
        // 1. حذف أي عقدة ميتة لم ترسل نبضات منذ أكثر من 3 دقائق وليست قائد حالي
        await supabase
            .from('whatsapp_nodes')
            .delete()
            .lt('last_seen', threeMinutesAgo)
            .neq('node_id', NODE_ID);

        // 2. تنظيف السجلات القديمة لنفس هذا الجهاز فقط للقناة الرئيسية (channel_id IS NULL)
        // ✅ إصلاح: تقييد الحذف بـ channel_id=null لمنع حذف عقد الأجهزة الأخرى التي تخدم قنوات مختلفة
        await supabase
            .from('whatsapp_nodes')
            .delete()
            .eq('hostname', os.hostname())
            .is('channel_id', null)
            .neq('node_id', NODE_ID)
            .lt('last_seen', new Date(Date.now() - 90 * 1000).toISOString()); // ✅ 90 ثانية بدلاً من 2 دقيقة
    } catch (e) {
        // Silently catch background pruning errors
    }
}

// ============================================================
// 2. LEADER ELECTION (Lock System - Atomic Compare-And-Swap)
// ============================================================

async function tryAcquireLock() {
    try {
        const hasSession = fs.existsSync(sessionDir);
        const healthScore = hasSession ? 100 : 70;

        // 1. استخدام الدالة الذرية المطورة مع قفل القناة ومعامل كفاءة العقدة
        const { data: rpcResult, error: rpcError } = await supabase
            .rpc('acquire_whatsapp_lock', {
                p_node_id: NODE_ID,
                p_timeout_seconds: Math.round(LOCK_TIMEOUT_MS / 1000),
                p_lock_key: lockKey,
                p_health_score: healthScore
            });

        if (!rpcError && rpcResult) {
            if (rpcResult.acquired) {
                log('LEADER', `✨ تم الاستحواذ على قفل القيادة بنجاح (${lockKey}) [كفاءة: ${healthScore}%]!`);
                await updateNodeTelemetry('leader');
                return true;
            } else {
                log('STANDBY', `القائد النشط (${lockKey}): ${rpcResult.leader_node}`);
                await updateNodeTelemetry('standby');
                return false;
            }
        }

        // 2. خطة بديلة مباشرة للجدول في حال عدم توفر الدالة (Graceful Fallback)
        const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', lockKey)
            .single();

        const now = Date.now();

        if (data?.value?.node_id && data.value.node_id !== NODE_ID) {
            const lastBeat = new Date(data.value.last_heartbeat).getTime();
            const age      = now - lastBeat;

            if (age < LOCK_TIMEOUT_MS) {
                log('STANDBY', `القائد النشط (${lockKey}): ${data.value.node_id} (منذ ${Math.round(age / 1000)}ث)`);
                await updateNodeTelemetry('standby');
                return false;
            }
            log('WARN', `القائد ${data.value.node_id} انقطع (منذ ${Math.round(age / 1000)}ث). جارٍ الاستحواذ...`);
        }

        const { error } = await supabase
            .from('system_settings')
            .upsert({
                key: lockKey,
                value: {
                    node_id:        NODE_ID,
                    last_heartbeat: new Date().toISOString(),
                    acquired_at:    new Date().toISOString(),
                    health_score:   healthScore
                },
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) throw error;
        log('LEADER', `✨ تم الاستحواذ على قفل القيادة (${lockKey}) عبر Fallback!`);
        await updateNodeTelemetry('leader');
        return true;
    } catch (err) {
        log('ERROR', 'خطأ في نظام القفل:', err.message);
        return false;
    }
}

async function releaseLock(reason = 'graceful_stepdown') {
    // ✅ إصلاح Failover: رفع نسخة احتياطية طارئة للجلسة قبل تحرير القفل
    // لضمان حصول العقدة الجديدة على الجلسة دون طلب QR جديد
    if (waClient?.info && fs.existsSync(sessionDir)) {
        log('INFO', '📦 [Pre-Release] رفع نسخة احتياطية طارئة للجلسة قبل تحرير القفل...');
        await backupSession().catch((e) => log('WARN', 'تعذر رفع النسخة الاحتياطية الطارئة:', e.message));
    }
    try {
        const { data, error } = await supabase.rpc('release_whatsapp_lock', {
            p_node_id: NODE_ID,
            p_lock_key: lockKey,
            p_reason: reason
        });

        if (error) {
            await supabase
                .from('system_settings')
                .upsert({
                    key: lockKey,
                    value: {
                        node_id:        null,
                        last_heartbeat: null,
                        released_at:    new Date().toISOString(),
                        released_by:    NODE_ID,
                        reason:         reason
                    },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
        }
        await updateNodeTelemetry('standby');
        log('INFO', `تم تحرير قفل القيادة (${lockKey}) بنجاح. السبب: ${reason}`);
    } catch (err) {
        log('ERROR', 'خطأ في تحرير القفل:', err.message);
    }
}

// ============================================================
// 3. HEARTBEAT & STEP DOWN (نبضات الحياة والتنحي الذكي)
// ============================================================

async function stepDown(releaseDbLock = false) {
    if (!isLeader) return;

    // ✅ إصلاح Failover: رفع نسخة احتياطية طارئة قبل تدمير عميل الواتساب
    // هذا يضمن أن العقدة الجديدة ستجد الجلسة في السحابة وتتصل مباشرة بدون QR
    if (waClient?.info && fs.existsSync(sessionDir)) {
        log('WARN', '📦 [Pre-StepDown] رفع نسخة احتياطية طارئة للجلسة قبل التنحي عن القيادة...');
        await backupSession().catch((e) => log('WARN', 'تعذر رفع النسخة الاحتياطية الطارئة في stepDown:', e.message));
    }

    log('WARN', 'جارٍ التنحي عن دور القيادة...');
    isLeader = false;
    connectingStartTime = null;
    isWhatsAppAuthenticated = false;

    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    
    if (pendingPollTimer) {
        clearInterval(pendingPollTimer);
        pendingPollTimer = null;
    }

    if (nodePruneTimer) {
        clearInterval(nodePruneTimer);
        nodePruneTimer = null;
    }

    if (realtimeChannel) {
        await supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    if (waClient) {
        try { await waClient.destroy(); } catch(e) {}
        waClient = null;
    }

    // ✅ إصلاح جذري: حذف الجلسة فقط عند فساد حقيقي مؤكد (auth_failure/LOGOUT)
    // وليس عند كل انقطاع مؤقت أو تنحي طبيعي (reconnect)
    if (sessionKnownCorrupted && fs.existsSync(sessionDir)) {
        log('WARN', '🧹 تطهير الجلسة المحلية الفاسدة (auth_failure/LOGOUT مؤكد)...');
        purgeLocalSession(sessionDir);
        sessionKnownCorrupted = false;
    } else if (fs.existsSync(sessionDir)) {
        log('INFO', '💾 الجلسة المحلية سليمة — لن تُحذف عند التنحي الطبيعي.');
    }

    if (releaseDbLock) {
        await releaseLock('proactive_failover_stepdown');
    }

    await updateNodeTelemetry('standby');
    await updateChannelStatus('disconnected', { qr_code: null });
    startStandbyWatcher();
}

let consecutiveFailedProbes = 0;
let lastSuccessfulHeartbeat  = Date.now(); // ✅ إصلاح 2: تتبع آخر heartbeat ناجح لحماية Split-Brain

function startHeartbeat() {
    consecutiveFailedProbes = 0;
    lastSuccessfulHeartbeat  = Date.now();
    heartbeatTimer = setInterval(async () => {
        if (!isLeader || isShuttingDown) return;
        try {
            // 1. فحص الحيوية الحقيقية لعميل الواتساب (Active Liveness Probe)
            const isClientAlive = await checkWhatsAppLiveness();
            if (!isClientAlive) {
                consecutiveFailedProbes++;
                // ✅ إصلاح 2: رفع العتبة من 2 إلى 3 لحماية من انقطاعات الشبكة العابرة (Split-Brain Guard)
                log('WARN', `⚠️ فحص حيوية عميل الواتساب فشل (${consecutiveFailedProbes}/3)...`);
                if (consecutiveFailedProbes >= 3) {
                    // حماية Split-Brain: فقط إذا كان العميل متصلاً ومصادقاً عليه من قبل
                    const timeSinceLastSuccess = Date.now() - lastSuccessfulHeartbeat;
                    if (timeSinceLastSuccess < 90_000 && isWhatsAppAuthenticated) {
                        log('WARN', `🛡️ Split-Brain Guard: آخر heartbeat ناجح كان منذ ${Math.round(timeSinceLastSuccess/1000)}ث فقط. الانتظار قبل التنازل...`);
                        return;
                    }
                    log('ERROR', '❌ القائد فقد الاتصال بالواتساب لأكثر من 3 دورات متتالية (90+ ثانية). التنازل الآمن عن القيادة...');
                    await stepDown(true);
                    return;
                }
            } else {
                consecutiveFailedProbes = 0;
                lastSuccessfulHeartbeat  = Date.now();
            }

            // 2. تجديد النبضة الذري (Atomic Heartbeat Renewal) للقناة المحددة
            const { data: renewed, error: renewError } = await supabase
                .rpc('renew_whatsapp_heartbeat', { 
                    p_node_id: NODE_ID,
                    p_lock_key: lockKey
                });

            if (!renewError && typeof renewed === 'boolean') {
                if (!renewed) {
                    log('WARN', 'فقدت القيادة (تم سحب القفل من جهاز آخر أو إدارياً). جارٍ التنحي...');
                    await stepDown(false);
                    return;
                }
                await updateNodeTelemetry('leader');
                if (waClient?.info) {
                    await updateChannelStatus('connected', {
                        phone_number: waClient.info?.wid?.user || null,
                        qr_code: null,
                        last_heartbeat: new Date().toISOString()
                    });
                } else {
                    await updateChannelStatus(undefined, {
                        last_heartbeat: new Date().toISOString()
                    });
                }
                return;
            }

            // Fallback مباشر أو قفل القناة المحددة
            const { data } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', lockKey)
                .single();
                
            if (!data || !data.value || data.value.node_id !== NODE_ID) {
                await stepDown(false);
                return;
            }

            await supabase
                .from('system_settings')
                .upsert({
                    key: lockKey,
                    value: {
                        node_id:        NODE_ID,
                        last_heartbeat: new Date().toISOString(),
                        acquired_at:    data.value.acquired_at || new Date().toISOString()
                    },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            await updateNodeTelemetry('leader');
            if (waClient?.info) {
                await updateChannelStatus('connected', {
                    phone_number: waClient.info?.wid?.user || null,
                    qr_code: null,
                    last_heartbeat: new Date().toISOString()
                });
            } else {
                await updateChannelStatus(undefined, {
                    last_heartbeat: new Date().toISOString()
                });
            }
        } catch (err) {
            log('ERROR', 'فشل إرسال نبضة الحياة:', err.message);
        }
    }, HEARTBEAT_INTERVAL_MS);
    log('LEADER', `نظام نبضات الحياة نشط (كل ${HEARTBEAT_INTERVAL_MS / 1000}ث) مع نظام الحماية من الزومبي`);
}

// ============================================================
// 4. STANDBY WATCHER (مراقبة القفل في وضع الانتظار)
// ============================================================

function startStandbyWatcher() {
    // 💡 Warm-Standby: فحص وتحميل الجلسة استباقياً فور الدخول في وضع الاستعداد إذا لم تكن موجودة محلياً
    if (!fs.existsSync(sessionDir) || fs.readdirSync(sessionDir).length === 0) {
        log('STANDBY', '🔍 [Warm-Standby] لا توجد جلسة محلية. فحص وتحميل الجلسة المحفوظة من السحابة في الخلفية...');
        syncSessionFromCloud(false).catch(() => {});
    }

    standbyTimer = setInterval(async () => {
        if (isLeader || isShuttingDown) return;
        await updateNodeTelemetry('standby');
        log('STANDBY', `فحص قفل القيادة (${lockKey})...`);

        // التحقق الدوري من جاهزية الجلسة محلياً أثناء الانتظار
        if (!fs.existsSync(sessionDir) || fs.readdirSync(sessionDir).length === 0) {
            syncSessionFromCloud(false).catch(() => {});
        }

        const acquired = await tryAcquireLock();
        if (acquired) {
            clearInterval(standbyTimer);
            standbyTimer = null;
            await becomeLeader();
        }
    }, STANDBY_CHECK_MS);
    log('STANDBY', `مراقبة القفل (كل ${STANDBY_CHECK_MS / 1000}ث). في وضع الانتظار المستعد (Warm Standby)...`);
}

// ============================================================
// 5. MESSAGE PROCESSING (معالجة الرسائل)
// ============================================================

// ✅ إصلاح 3: دالة مساعدة للـ retry مع exponential backoff
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWithRetry(waClient, chatId, message, pdf_url, maxRetries = 2) {
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (pdf_url) {
                const media = await MessageMedia.fromUrl(pdf_url, { unsafeMime: true });
                await waClient.sendMessage(chatId, media, { caption: message || '' });
            } else {
                await waClient.sendMessage(chatId, message);
            }
            return; // نجح
        } catch (err) {
            lastErr = err;
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt + 1) * 1500; // 3s, 6s
                log('WARN', `⚠️ محاولة إرسال فاشلة (${attempt + 1}/${maxRetries + 1}). إعادة المحاولة خلال ${delay/1000}ث... [${err.message}]`);
                await sleep(delay);
            }
        }
    }
    throw lastErr;
}

async function processMessage(record) {
    if (CHANNEL_ID && record.channel_id && record.channel_id !== CHANNEL_ID) {
        return; // الرسالة مخصصة لقناة أخرى
    }
    const { id, phone, message, pdf_url } = record;
    log('LEADER', `معالجة رسالة #${id} (أولوية: ${record.priority || 0}) → ${phone}`);

    // ✅ إصلاح 1: استخدام `processing` بدلاً من `sending` ليتوافق مع schema الجدول
    // والتحقق الذري الصحيح من النجاح لمنع المعالجة المزدوجة عند تغيير الزعيم
    const { data: claimedRows, error: claimError } = await supabase
        .from('whatsapp_queue')
        .update({ status: 'processing', node_id: NODE_ID, processed_at: new Date().toISOString() })
        .eq('id', id)
        .in('status', ['pending']) // ✅ الشرط الذري: فقط إذا كانت لا تزال pending
        .select('id');

    if (claimError) {
        log('WARN', `⚠️ خطأ في استلام رسالة #${id}: ${claimError.message}`);
        return;
    }
    if (!claimedRows || claimedRows.length === 0) {
        log('WARN', `⚠️ رسالة #${id} تم استلامها مسبقاً بواسطة عقدة أخرى أو حالتها تغيرت. تخطي...`);
        return;
    }

    try {
        if (!waClient?.info) {
            throw new Error('عميل الواتساب غير جاهز بعد');
        }

        const rawPhone = String(phone || '').trim();
        let chatId;
        if (rawPhone.includes('@lid') || rawPhone.replace(/\D/g, '').length >= 15) {
            const lidDigits = rawPhone.replace(/\D/g, '');
            chatId = `${lidDigits}@lid`;
        } else if (rawPhone.includes('@c.us')) {
            chatId = rawPhone;
        } else {
            const cleanPhone = rawPhone.replace(/\D/g, '');
            chatId = `${cleanPhone}@c.us`;
        }

        // ✅ إصلاح 3: إرسال مع Retry تلقائي (2 محاولات إضافية مع exponential backoff)
        await sendWithRetry(waClient, chatId, message, pdf_url, 2);

        await supabase
            .from('whatsapp_queue')
            .update({
                status:       'sent',
                processed_at: new Date().toISOString(),
                node_id:      NODE_ID,
                error:        null
            })
            .eq('id', id);

        log('SUCCESS', `✅ تم إرسال الرسالة #${id} بنجاح إلى ${chatId}`);
    } catch (err) {
        log('ERROR', `❌ فشل إرسال الرسالة #${id} بعد جميع المحاولات: ${err.message}`);

        await supabase
            .from('whatsapp_queue')
            .update({
                status:       'failed',
                error:        err.message,
                processed_at: new Date().toISOString()
            })
            .eq('id', id);
    }
}

// ✅ إصلاح 7: معالجة متوازية للرسائل - 3 رسائل في وقت واحد لتسريع المعالجة مع كثرة العملاء
async function processBatch(messages) {
    const CONCURRENCY = 3;
    const MSG_DELAY   = 1200; // ms بين كل رسالة داخل نفس الدفعة
    for (let i = 0; i < messages.length; i += CONCURRENCY) {
        if (!isLeader) break;
        const chunk = messages.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(msg => processMessage(msg)));
        if (i + CONCURRENCY < messages.length) {
            await sleep(MSG_DELAY);
        }
    }
}

// معالجة الرسائل المتراكمة (شبكة أمان مع استرجاع الانقطاعات وأولويات الإرسال)
async function processPendingMessages() {
    if (!isLeader || !waClient?.info) return;
    try {
        // ✅ إصلاح 1+8: استرجاع الرسائل العالقة في حالة `processing` (كانت `sending`) لأكثر من 3 دقائق
        const staleTime = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        let recoverQuery = supabase
            .from('whatsapp_queue')
            .update({ status: 'pending', error: 'استرجاع تلقائي من انقطاع أثناء المعالجة' })
            .in('status', ['processing', 'sending']) // ✅ استرجاع كلا الحالتين للتوافق مع السجلات القديمة
            .lt('processed_at', staleTime);

        if (CHANNEL_ID) {
            recoverQuery = recoverQuery.eq('channel_id', CHANNEL_ID);
        }
        await recoverQuery;

        // 2. سحب الرسائل المعلقة مرتبة بحسب الأولوية أولاً ثم الأقدمية
        let query = supabase
            .from('whatsapp_queue')
            .select('*')
            .eq('status', 'pending');

        if (CHANNEL_ID) {
            query = query.eq('channel_id', CHANNEL_ID);
        }

        const { data: pending } = await query
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(15); // ✅ إصلاح 7: رفع الحد من 10 إلى 15 رسالة في كل دورة

        if (pending && pending.length > 0) {
            log('LEADER', `📬 وجدت ${pending.length} رسالة pending. جارٍ المعالجة المتوازية (3 في وقت واحد)...`);
            await processBatch(pending);
        }
    } catch (err) {
        log('ERROR', 'خطأ في فحص الرسائل المتراكمة:', err.message);
    }
}

// ============================================================
// 6. REALTIME SUBSCRIPTION (الاشتراك في الأحداث الفورية)
// ============================================================

function subscribeToSettings() {
    settingsChannel = supabase
        .channel(`whatsapp-settings-changes${CHANNEL_ID ? `-${CHANNEL_ID}` : ''}`)
        .on(
            'postgres_changes',
            {
                event:  '*',
                schema: 'public',
                table:  'system_settings',
                filter: `key=eq.${lockKey}`
            },
            async (payload) => {
                const newValue = payload.new?.value;

                // 1. إذا كنا القائد، والتحكم تم سحبه منا أو إدارياً
                if (isLeader) {
                    if (!newValue || !newValue.node_id || newValue.node_id !== NODE_ID) {
                        log('WARN', '⚠️ تم رصد انتقال قفل القيادة إلى عقدة أخرى أو تحريره إدارياً عبر Realtime.');
                        await stepDown(false);
                    }
                    return;
                }

                // 2. إذا كنا في وضع الاستعداد، وتم إخلاء القفل فورياً (Fast-Track Reactive Takeover)
                if (!isLeader && !isShuttingDown) {
                    const isLockFree = !newValue || !newValue.node_id;
                    if (isLockFree) {
                        log('STANDBY', '⚡ رصد إخلاء فوري لقفل القيادة عبر Realtime! بدء الاستحواذ الذكي...');
                        const hasSession = fs.existsSync(sessionDir);
                        const baseDelay = hasSession ? 50 : 350;
                        const jitter = baseDelay + Math.floor(Math.random() * 300);

                        setTimeout(async () => {
                            if (!isLeader && !isShuttingDown) {
                                const acquired = await tryAcquireLock();
                                if (acquired) {
                                    if (standbyTimer) { clearInterval(standbyTimer); standbyTimer = null; }
                                    await becomeLeader();
                                }
                            }
                        }, jitter);
                    }
                }
            }
        )
        // ✅ استقبال إشعارات الجلسات الاستباقية للمستعد (Eager Replication)
        .on(
            'postgres_changes',
            {
                event:  '*',
                schema: 'public',
                table:  'system_settings',
                filter: `key=eq.${sessionStorageKey}`
            },
            async (payload) => {
                if (isLeader || isShuttingDown) return;

                if (payload.eventType === 'DELETE' || payload.new?.value?.status === 'revoked') {
                    log('STANDBY', '🧹 [Warm-Standby] تم رصد إلغاء الجلسة مركزياً. تطهير الجلسة المحلية للمستعد...');
                    purgeLocalSession(sessionDir);
                    return;
                }

                if (payload.new?.value?.status === 'ready') {
                    log('STANDBY', '📥 [Warm-Standby] تم رصد جلسة جديدة أو محدثة للقناة عبر Realtime! بدء التحميل والتجهيز المسبق للمستعد...');
                    const jitter = Math.floor(Math.random() * 2000);
                    setTimeout(() => {
                        if (!isLeader && !isShuttingDown) {
                            syncSessionFromCloud(true);
                        }
                    }, jitter);
                }
            }
        )
        .subscribe();
}

let controlSub = null;
function subscribeToControlCommands() {
    controlSub = supabase
        .channel(`whatsapp-control-commands${CHANNEL_ID ? `-${CHANNEL_ID}` : ''}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'system_settings',
                filter: `key=eq.${controlCommandKey}`
            },
            async (payload) => {
                const cmd = payload.new?.value;
                if (!cmd || !isLeader) return;
                log('INFO', `📡 استلام أمر تحكم إداري: ${JSON.stringify(cmd)}`);
                if (cmd.action === 'force_disconnect' || cmd.action === 'reset_session') {
                    await handleSessionLogout(`admin_command_${cmd.action}`);
                } else if (cmd.action === 'refresh_qr') {
                    log('INFO', '🔄 استلام أمر تحديث الرمز من لوحة التحكم...');
                    if (waClient?.pupPage && !isWhatsAppAuthenticated) {
                        try {
                            const clicked = await waClient.pupPage.evaluate(() => {
                                const btn = document.querySelector('button[aria-label*="Reload"], button[aria-label*="إعادة"], span[data-icon="refresh"], [data-ref] button, button._ak4w, div[role="button"][aria-label*="QR"]');
                                if (btn) {
                                    btn.click();
                                    return true;
                                }
                                return false;
                            });
                            if (!clicked) {
                                await waClient.pupPage.reload();
                            }
                        } catch(e) {
                            try { await waClient.pupPage.reload(); } catch(e2) {}
                        }
                    }
                }
            }
        )
        .subscribe();
}

function subscribeToQueue() {
    // ✅ إصلاح 4: إزالة فلتر `status=eq.pending` غير الموثوق في Supabase Realtime على INSERT
    // الاشتراك في كل INSERT ثم الفلترة في الكود لضمان وصول جميع الرسائل
    realtimeChannel = supabase
        .channel(`whatsapp-queue-changes${CHANNEL_ID ? `-${CHANNEL_ID}` : ''}`)
        .on(
            'postgres_changes',
            {
                event:  'INSERT',
                schema: 'public',
                table:  'whatsapp_queue'
                // ✅ إزالة filter: 'status=eq.pending' - غير موثوق على بعض إصدارات Supabase
            },
            async (payload) => {
                if (!isLeader) return;
                // ✅ الفلترة في الكود بدلاً من قاعدة البيانات لضمان الموثوقية الكاملة
                if (payload.new.status !== 'pending') return;
                if (CHANNEL_ID && payload.new.channel_id && payload.new.channel_id !== CHANNEL_ID) {
                    return;
                }
                log('LEADER', `📨 رسالة جديدة عبر Realtime! ID: ${payload.new.id}`);
                // ✅ تأخير قصير لمنع race condition مع insert transaction
                setTimeout(() => processMessage(payload.new), 300);
            }
        )
        .on(
            'postgres_changes',
            {
                event:  'UPDATE',
                schema: 'public',
                table:  'whatsapp_queue'
            },
            async (payload) => {
                // ✅ إصلاح 4: مراقبة تحديثات الحالة - إذا أُعيد ضبط رسالة إلى pending من الأدمن
                if (!isLeader) return;
                if (payload.new.status !== 'pending') return;
                if (CHANNEL_ID && payload.new.channel_id && payload.new.channel_id !== CHANNEL_ID) {
                    return;
                }
                log('LEADER', `🔄 رسالة #${payload.new.id} أُعيدت للطابور عبر Realtime. معالجة فورية...`);
                setTimeout(() => processMessage(payload.new), 300);
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                log('LEADER', '📡 مشترك في طابور الرسائل (INSERT + UPDATE). جاهز للاستماع!');
                processPendingMessages();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                // ✅ إصلاح إضافي: إعادة الاتصال التلقائي عند انقطاع Realtime
                log('WARN', `⚠️ انقطع اشتراك Realtime (${status}). إعادة الاتصال خلال 5 ثواني...`);
                setTimeout(() => {
                    if (isLeader && !isShuttingDown) {
                        if (realtimeChannel) {
                            supabase.removeChannel(realtimeChannel).catch(() => {});
                            realtimeChannel = null;
                        }
                        subscribeToQueue();
                    }
                }, 5000);
            }
        });
}

// ============================================================
// 7. WHATSAPP CLIENT (عميل الواتساب)
// ============================================================

async function initWhatsApp() {
    // ✅ إصلاح race condition: منع تشغيل نسختين متزامنتين من عميل الواتساب
    if (isInitializingWhatsApp) {
        log('WARN', '⚠️ تهيئة الواتساب جارية بالفعل. تجاهل الطلب المكرر.');
        return;
    }
    if (!isLeader || isShuttingDown) {
        log('WARN', '⚠️ لم نعد قائدين أو النظام في وضع الإغلاق. إلغاء تهيئة الواتساب.');
        return;
    }
    isInitializingWhatsApp = true;
    log('LEADER', 'جارٍ تهيئة عميل الواتساب...');
    connectingStartTime = Date.now();
    isWhatsAppAuthenticated = false;

    // تصفير أي رمز قديم في قاعدة البيانات فور بدء المحاولة لضمان عدم عرض رمز منتهي للمستخدم
    try {
        await updateChannelStatus('qr_pending', {
            qr_code: null,
            phone_number: null,
            last_heartbeat: new Date().toISOString()
        });
        await supabase.from('system_settings').delete().eq('key', qrKey);
    } catch (e) {}

    // 0. انتظار اكتمال أي عملية مزامنة للجلسة جارية في الخلفية (Warm-Standby Guard)
    if (isSyncingSession) {
        log('LEADER', '⏳ [Warm-Standby] جاري اكتمال تثبيت الجلسة المستلمة مسبقاً قبل الإطلاق...');
        let waitCount = 0;
        while (isSyncingSession && waitCount < 30) {
            await sleep(500);
            waitCount++;
        }
    }

    // 1. تنظيف أقفال كروميوم القديمة لمنع مشاكل SingletonLock عند الإقلاع
    cleanChromiumLocks(sessionDir);

    // 2. استعادة الجلسة المحفوظة سحابياً إن وُجدت
    // في نظام Warm-Standby ستكون الجلسة محملة محلياً مسبقاً
    let sessionRestored = await restoreSession();
    if (!sessionRestored && GITHUB_TOKEN && GITHUB_SESSION_REPO) {
        log('LEADER', '⏳ [Failover] لا توجد جلسة محلية. محاولة مزامنة مباشرة من السحابة...');
        sessionRestored = await syncSessionFromCloud(true);
        if (sessionRestored) {
            log('LEADER', '✅ [Failover] تم استعادة وتثبيت الجلسة بنجاح! جاري الاتصال بدون QR...');
        } else {
            log('LEADER', 'ℹ️ لا توجد جلسة سحابية متاحة. سيتم عرض QR للمسؤول.');
        }
    }

    // ✅ إصلاح 6: webVersionCache - استخدام local cache أولاً، ثم remote كـ fallback فقط
    const localWaCachePath = path.join(baseDataDir, 'wa-version-cache.html');
    const waVersionCacheConfig = fs.existsSync(localWaCachePath)
        ? { type: 'local', path: localWaCachePath }
        : {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1048120390-alpha.html',
          };
    if (!fs.existsSync(localWaCachePath)) {
        log('INFO', '🌐 سيتم تحميل إصدار WhatsApp Web عبر الإنترنت (أول مرة فقط)...');
    } else {
        log('INFO', '📁 استخدام نسخة WhatsApp Web المحلية المحفوظة (Zero-Egress).');
    }

    waClient = new Client({
        authStrategy: new LocalAuth({ dataPath: sessionDir }),
        puppeteer: {
            headless: true,
            executablePath: findBrowser(),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1920,1080',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
                '--memory-pressure-off',           // ✅ إضافي: تقليل ضغط الذاكرة على الأجهزة القديمة
                '--disable-background-networking',  // ✅ إضافي: تقليل استهلاك الشبكة في الخلفية
            ],
            defaultViewport: { width: 1920, height: 1080 },
            ignoreHTTPSErrors: true,
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        webVersionCache: waVersionCacheConfig,
    });

    waClient.on('qr', (qr) => {
        connectingStartTime = Date.now();
        isWhatsAppAuthenticated = false;
        lastBackupTime = 0; // ✅ تصفير توقيت آخر نسخ لضمان رفع الجلسة فورياً عند المسح الناجح
        log('WARN', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('WARN', `يجب مسح QR Code لتسجيل الدخول! (${lockKey})`);
        log('WARN', 'قم بفتح لوحة التحكم - بوابة الواتساب لمسح الكود.');
        log('WARN', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // حفظ QR في DB
        supabase.from('system_settings').upsert({
            key: qrKey,
            value: { qr, node_id: NODE_ID, timestamp: new Date().toISOString() },
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' }).then(() => {});

        updateChannelStatus('qr_pending', {
            qr_code: qr,
            phone_number: null,
            last_heartbeat: new Date().toISOString()
        });
    });

    waClient.on('ready', async () => {
        log('SUCCESS', '🟢 عميل الواتساب جاهز! بدء الاستماع للطابور...');
        isWhatsAppAuthenticated = true;
        sessionKnownCorrupted = false; // ✅ الجلسة سليمة — إعادة تعيين علامة الفساد
        connectingStartTime = null;
        isInitializingWhatsApp = false; // ✅ إعادة تعيين علامة التهيئة

        // ✅ رفع فوري للجلسة إذا كانت جديدة (بعد مسح QR أو أول اتصال) لحمايتها ومشاركتها مع المستعد
        const isNewSession = !lastBackupTime;
        const now = Date.now();
        if (isNewSession || (now - lastBackupTime > BACKUP_THROTTLE_MS)) {
            lastBackupTime = now;
            backupSession();
        } else {
            log('INFO', `⏭️ تجاوز النسخ الاحتياطي: آخر نسخة كانت منذ ${Math.round((now - lastBackupTime) / 60000)} دقيقة فقط.`);
        }
        
        // ✅ إصلاح: تنظيف الاشتراكات والـ Timers القديمة قبل إنشاء جديدة لتجنب تكرار الاشتراك
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel).catch(() => {});
            realtimeChannel = null;
        }
        if (pendingPollTimer) {
            clearInterval(pendingPollTimer);
            pendingPollTimer = null;
        }
        subscribeToQueue();
        pendingPollTimer = setInterval(processPendingMessages, PENDING_POLL_MS);
        
        // مسح الـ QR القديم لأن الاتصال نجح
        supabase.from('system_settings').delete().eq('key', qrKey).then(() => {});

        // تفعيل حالة الحضور كـ متصل أونلاين لكي تظهر حالات الكتابة (typing) للطرف الآخر
        try {
            if (typeof waClient.sendPresenceAvailable === 'function') {
                await waClient.sendPresenceAvailable();
                log('INFO', '📡 تم تفعيل حالة الاتصال (Online Presence) للرقم بنجاح');
            }
        } catch (presErr) {
            log('WARN', 'تعذر تفعيل حالة الاتصال:', presErr.message);
        }

        const phone = waClient.info?.wid?.user || null;
        updateChannelStatus('connected', {
            phone_number: phone,
            qr_code: null,
            last_heartbeat: new Date().toISOString()
        });
    });

    // 8. AI AGENT INCOMING MESSAGES HANDLER
    waClient.on('message', async (msg) => {
        try {
            const channelConfig = await getActiveChannelConfig();
            if (channelConfig && channelConfig.ai_enabled) {
                await handleIncomingWhatsAppMessage(waClient, channelConfig, msg, supabase);
            }
        } catch (err) {
            log('ERROR', 'خطأ في معالجة رسالة الوارد عبر الذكاء الاصطناعي:', err.message);
        }
    });

    waClient.on('authenticated', () => {
        log('SUCCESS', '🔐 تم التحقق من الواتساب بنجاح!');
        isWhatsAppAuthenticated = true;
        connectingStartTime = null;
        // ✅ لا نحتاج لعمل backupSession هنا — تم نقله إلى حدث ready فقط لمنع race condition
        
        // مسح الـ QR من لوحة التحكم
        supabase.from('system_settings').delete().eq('key', qrKey).then(() => {});
    });

    waClient.on('auth_failure', async (msg) => {
        log('ERROR', 'فشل التحقق من الواتساب:', msg);
        await handleSessionLogout(`auth_failure_${msg}`);
    });

    waClient.on('disconnected', async (reason) => {
        log('WARN', 'انقطع الاتصال بالواتساب. السبب:', reason);
        const reasonStr = String(reason || '').toUpperCase();
        if (reasonStr.includes('LOGOUT') || reasonStr.includes('UNPAIRED') || reasonStr.includes('REVOKED')) {
            await handleSessionLogout(`logout_${reason}`);
        } else {
            await updateChannelStatus('disconnected', { qr_code: null });
            if (isLeader && !isShuttingDown) {
                log('WARN', 'القائد انقطع اتصاله بالواتساب مؤقتاً. محاولة إعادة التهيئة النظيفة...');
                setTimeout(async () => {
                    // ✅ إصلاح race condition: التحقق من حالة القيادة والتهيئة قبل إعادة الإطلاق
                    if (isLeader && !isShuttingDown && !isInitializingWhatsApp) {
                        try {
                            // ✅ إصلاح: تنظيف شامل للموارد قبل إعادة التهيئة لمنع تكرار الاشتراكات
                            if (realtimeChannel) {
                                supabase.removeChannel(realtimeChannel).catch(() => {});
                                realtimeChannel = null;
                            }
                            if (pendingPollTimer) {
                                clearInterval(pendingPollTimer);
                                pendingPollTimer = null;
                            }
                            if (waClient) { await waClient.destroy(); waClient = null; }
                            await initWhatsApp();
                        } catch (e) {
                            log('ERROR', 'فشل إعادة تهيئة الواتساب بعد الانقطاع:', e.message);
                            await stepDown(true);
                        }
                    }
                }, 4000);
            }
        }
    });

    try {
        await waClient.initialize();
    } catch (initErr) {
        log('ERROR', 'فشل تشغيل متصفح الواتساب:', initErr.message);
        if (waClient) {
            try { await waClient.destroy(); } catch (e) {}
            waClient = null;
        }
        throw initErr;
    } finally {
        isInitializingWhatsApp = false;
    }

    // فحص دوري للنقر على زر إعادة تحميل الـ QR إذا ظهر على الصفحة لتجديد الرمز تلقائياً
    const qrReloadInterval = setInterval(async () => {
        if (!isLeader || isWhatsAppAuthenticated || isShuttingDown || !waClient?.pupPage || waClient.pupPage.isClosed()) {
            clearInterval(qrReloadInterval);
            return;
        }
        try {
            await waClient.pupPage.evaluate(() => {
                const btn = document.querySelector('button[aria-label*="Reload"], button[aria-label*="إعادة"], span[data-icon="refresh"], [data-ref] button, button._ak4w, div[role="button"][aria-label*="QR"]');
                if (btn) btn.click();
            });
        } catch (e) {}
    }, 15000);
}

// ============================================================
// 8. BECOME LEADER (الانتقال لحالة القيادة)
// ============================================================

// ============================================================
// 7.5 SESSION BACKUP (حفظ احتياطي للجلسة في السحابة)
// ============================================================

let isBackingUp = false; // ✅ guard: prevents concurrent backup operations

async function backupSession() {
    if (isBackingUp) {
        log('INFO', 'عملية نسخ احتياطي جارية بالفعل، تخطي الطلب المكرر...');
        return;
    }
    isBackingUp = true;
    try {
        if (!fs.existsSync(sessionDir)) {
            log('INFO', 'مجلد الجلسة غير موجود. تخطي النسخ الاحتياطي.');
            return;
        }

        const token = GITHUB_TOKEN;
        const repo = GITHUB_SESSION_REPO;
        if (!token || !repo) {
            log('WARN', 'بيانات GitHub Private Repo غير متوفرة في .env. تم الاكتفاء بالجلسة المحلية.');
            return;
        }

        log('INFO', '📦 جارٍ ضغط وتشفير جلسة الواتساب للنسخ الاحتياطي السحابي...');
        const zip = new AdmZip();
        addFolderFilteredToZip(zip, sessionDir);
        const zipBuffer = zip.toBuffer();
        log('INFO', `حجم الجلسة بعد الفلترة والضغط: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

        const encryptedBuffer = encryptBuffer(zipBuffer);

        log('INFO', `🔒 جارٍ رفع الجلسة المشفرة إلى مستودع GitHub الخاص (${repo})...`);
        let relRes = await githubApiRequest(`/repos/${repo}/releases/tags/whatsapp-session-sync`, 'GET', null, token);
        if (relRes.status === 404) {
            relRes = await githubApiRequest(`/repos/${repo}/releases`, 'POST', {
                tag_name: 'whatsapp-session-sync',
                name: 'WhatsApp Session Sync',
                body: 'Internal encrypted session storage for KWADER WhatsApp Node Failover',
                draft: false,
                prerelease: true
            }, token);
        }

        if (!relRes.data || !relRes.data.id) {
            throw new Error(`تعذر الوصول إلى الـ Release في GitHub (Status: ${relRes.status})`);
        }

        const releaseId = relRes.data.id;
        const uploadUrl = relRes.data.upload_url.split('{')[0];
        const assetName = `${sessionStorageKey}.enc`;

        // حذف الـ Asset القديم إن وجد لضمان عدم تراكم الملفات
        const assetsRes = await githubApiRequest(`/repos/${repo}/releases/${releaseId}/assets`, 'GET', null, token);
        if (Array.isArray(assetsRes.data)) {
            for (const a of assetsRes.data) {
                if (a.name === assetName) {
                    await githubApiRequest(`/repos/${repo}/releases/assets/${a.id}`, 'DELETE', null, token);
                }
            }
        }

        // رفع الـ Asset المشفر الجديد كـ Binary Stream مباشر
        const uploadRes = await githubApiRequest(`${uploadUrl}?name=${assetName}`, 'POST', encryptedBuffer, token, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': encryptedBuffer.length
        });

        if (uploadRes.status === 201 || uploadRes.status === 200) {
            log('SUCCESS', `✅ تم حفظ نسخة مشفرة للجلسة بنجاح في GitHub Private Repo (${(encryptedBuffer.length / 1024 / 1024).toFixed(2)} MB).`);

            // 1. حفظ بيانات الإصدار محلياً
            try {
                const sessionVersionFile = path.join(baseDataDir, `.session_ver${channelFolderSuffix}.json`);
                fs.writeFileSync(sessionVersionFile, JSON.stringify({
                    asset_name: assetName,
                    updated_at: new Date().toISOString(),
                    synced_at: new Date().toISOString()
                }), 'utf8');
            } catch (e) {}

            // 2. إشعار جميع العقد المستعدة عبر Supabase Realtime بتحميل الجلسة فوراً
            try {
                await supabase
                    .from('system_settings')
                    .upsert({
                        key: sessionStorageKey,
                        value: {
                            version: Date.now(),
                            updated_at: new Date().toISOString(),
                            updated_by: NODE_ID,
                            status: 'ready'
                        },
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                log('INFO', '📡 [Warm-Standby] تم بث إشعار توفر الجلسة لجميع العقد المستعدة لمزامنتها مسبقاً.');
            } catch (err) {
                log('WARN', 'تعذر تحديث إشعار الجلسة في system_settings:', err.message);
            }
        } else {
            throw new Error(`فشل رفع الـ Asset إلى GitHub (Status: ${uploadRes.status})`);
        }
    } catch (err) {
        log('ERROR', `خطأ في النسخ الاحتياطي للجلسة عبر GitHub: ${err.message}`);
    } finally {
        isBackingUp = false;
    }
}

// ============================================================
// 8. BECOME LEADER (الانتقال لحالة القيادة)
// ============================================================

async function becomeLeader() {
    isLeader = true;

    // ✅ إصلاح CMD Flash: تأخير 2 ثانية ثم إعادة التحقق من ثبات القفل
    // يمنع هذا إطلاق Chrome إذا سُحب القفل مباشرة بعد الاستحواذ (split-brain race)
    log('LEADER', '⏳ [Anti-Flash] انتظار 2 ثانية للتأكد من ثبات القفل قبل تشغيل المتصفح...');
    await new Promise(r => setTimeout(r, 2000));
    if (!isLeader || isShuttingDown) {
        log('WARN', '🛑 [Anti-Flash] فقدنا القيادة خلال فترة الانتظار. إلغاء تشغيل Chrome والعودة لوضع الانتظار...');
        startStandbyWatcher();
        return;
    }

    log('LEADER', '══════════════════════════════════');
    log('LEADER', `هذا الجهاز أصبح القائد النشط (${lockKey})!`);
    log('LEADER', `Node ID: ${NODE_ID}`);
    log('LEADER', '══════════════════════════════════');
    startHeartbeat();

    // تشغيل تنظيف العقد الميتة تلقائياً كل 10 دقائق من قبل القائد الرئيسي
    if (!CHANNEL_ID) {
        pruneStaleNodes().catch(() => {});
        if (!nodePruneTimer) {
            nodePruneTimer = setInterval(pruneStaleNodes, 10 * 60 * 1000);
        }
    }

    try {
        await initWhatsApp();
    } catch (err) {
        log('ERROR', 'فشل خطير أثناء تهيئة الواتساب (قد يكون المتصفح غير موجود):', err.message);
        await stepDown(true);
    }
}

// ============================================================
// 9. GRACEFUL SHUTDOWN (الإغلاق الآمن)
// ============================================================

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log('INFO', `استقبال إشارة الإغلاق (${signal}). جارٍ الإغلاق الآمن...`);

    if (heartbeatTimer)   clearInterval(heartbeatTimer);
    if (standbyTimer)     clearInterval(standbyTimer);
    if (pendingPollTimer) clearInterval(pendingPollTimer);
    if (nodePruneTimer)   clearInterval(nodePruneTimer);

    if (realtimeChannel) {
        await supabase.removeChannel(realtimeChannel);
    }
    
    if (settingsChannel) {
        await supabase.removeChannel(settingsChannel);
    }

    if (isLeader) {
        await releaseLock('process_shutdown');
        log('INFO', 'تم تحرير القفل فورياً. العقد في وضع الاستعداد ستستحوذ خلال أجزاء من الثانية.');
    }

    if (waClient) {
        try { await waClient.destroy(); } catch (e) {}
    }

    // إغلاق العقد الفرعية للقنوات الأخرى
    for (const [id, worker] of channelWorkers.entries()) {
        try { worker.kill('SIGTERM'); } catch (e) {}
    }
    channelWorkers.clear();

    if (channelsSub) {
        await supabase.removeChannel(channelsSub);
        channelsSub = null;
    }

    if (controlSub) {
        await supabase.removeChannel(controlSub);
        controlSub = null;
    }

    await updateNodeTelemetry('offline');
    await updateChannelStatus('disconnected', { qr_code: null });

    log('SUCCESS', 'تم الإغلاق الآمن بنجاح. وداعاً!');
    process.exit(0);
}

// ✅ إصلاح: إزالة معالجات SIGTERM/SIGINT المكررة من دالة shutdown القديمة
// (معالج handleGracefulExit المُستخدم الفعلي موجود أسفل الملف)
process.on('SIGQUIT', () => handleGracefulExit('SIGQUIT'));

// ============================================================
// 9.5 MULTI-CHANNEL ORCHESTRATOR (إدارة القنوات المتعددة)
// ============================================================
const channelWorkers = new Map();
let channelsSub = null;
let channelSyncTimer = null;
let isSyncingWorkers = false;
let lastSyncTime = 0;

function terminateWorkerProcess(worker) {
    if (!worker || !worker.pid) return;
    try {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', worker.pid.toString(), '/T', '/F']);
        } else {
            worker.kill('SIGTERM');
        }
    } catch (e) {}
}

async function syncChannelWorkers() {
    if (CHANNEL_ID || isShuttingDown) return; // العقدة الرئيسية فقط هي التي تدير العقد الفرعية
    const now = Date.now();
    if (isSyncingWorkers || (now - lastSyncTime < 4000)) return;
    isSyncingWorkers = true;
    lastSyncTime = now;

    try {
        // 1. سياسة توفير موارد ورامات العميل: فحص هل يُسمح بتشغيل أكثر من قناة على نفس الجهاز
        const { data: multiSetting } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'whatsapp_allow_multi_channel')
            .maybeSingle();

        const isMultiChannelAllowed = multiSetting?.value === true || multiSetting?.value?.enabled === true;

        // الوضع الافتراضي الاحترافي (حماية رامات العميل): قناة واحدة لكل جهاز
        if (!isMultiChannelAllowed) {
            if (channelWorkers.size > 0) {
                log('INFO', '🔒 وضع القناة الواحدة لكل جهاز نشط (توفير رامات العميل). إيقاف أي عمال فرعيين محليين...');
                for (const [id, worker] of channelWorkers.entries()) {
                    terminateWorkerProcess(worker);
                    channelWorkers.delete(id);
                }
            }
            try {
                await supabase
                    .from('whatsapp_nodes')
                    .delete()
                    .eq('hostname', os.hostname())
                    .not('channel_id', 'is', null);
            } catch (e) {}
            return;
        }

        const { data: nonDefaultChannels, error } = await supabase
            .from('whatsapp_channels')
            .select('id, name, status, is_default')
            .eq('is_default', false);

        if (error || !nonDefaultChannels) return;

        // فحص العقد النشطة حالياً في الشبكة اللامركزية لمعرفة القنوات المخدومة من أجهزة أخرى
        const { data: allActiveNodes } = await supabase
            .from('whatsapp_nodes')
            .select('node_id, hostname, channel_id, role, last_seen, status')
            .eq('status', 'online');

        const activeChannelIds = new Set(nonDefaultChannels.map(c => c.id));

        // حصر القنوات التي يخدمها جهاز مخصص آخر بنبضة حياة حية (< 2 دقيقة)
        const channelsServedByOtherNodes = new Set();
        if (allActiveNodes) {
            for (const n of allActiveNodes) {
                if (n.hostname !== os.hostname() && n.channel_id) {
                    const lastSeenMs = n.last_seen ? new Date(n.last_seen).getTime() : 0;
                    if (now - lastSeenMs < 120_000) {
                        channelsServedByOtherNodes.add(n.channel_id);
                    }
                }
            }
        }

        // 1. إيقاف العقد المحلية إذا تم حذف القناة أو إذا أصبح هناك جهاز خارجي مخصص يخدمها
        for (const [id, worker] of channelWorkers.entries()) {
            const channelDeleted = !activeChannelIds.has(id);
            const servedElsewhere = channelsServedByOtherNodes.has(id);

            if (channelDeleted || servedElsewhere) {
                if (servedElsewhere) {
                    log('INFO', `القناة (${id.substring(0, 8)}) أصبحت مخدومة بواسطة جهاز خارجي نشط. إيقاف العامل المحلي لتخفيف الحمل...`);
                } else {
                    log('INFO', `القناة (${id.substring(0, 8)}) تم حذفها. جارٍ إنهاء العقدة الفرعية التابعة لها...`);
                }
                terminateWorkerProcess(worker);
                channelWorkers.delete(id);
            }
        }

        // 2. تشغيل عقدة فرعية محلية فقط للقنوات التي لا تملك أي جهاز خارجي مخصص يخدمها
        for (const ch of nonDefaultChannels) {
            const isServedElsewhere = channelsServedByOtherNodes.has(ch.id);
            if (!isServedElsewhere && !channelWorkers.has(ch.id)) {
                spawnChannelWorker(ch);
            }
        }
    } catch (err) {
        log('WARN', 'خطأ في مزامنة عمال القنوات:', err.message);
    } finally {
        isSyncingWorkers = false;
    }
}

function spawnChannelWorker(channel) {
    if (channelWorkers.has(channel.id) || isShuttingDown) return;
    log('INFO', `🚀 تشغيل عقدة مخصصة للقناة: ${channel.name} (${channel.id.substring(0, 8)})...`);
    
    const isPackaged = Boolean(process.pkg);
    const workerEnv = {
        ...process.env,
        CHANNEL_ID: channel.id,
        CHANNEL_NAME: channel.name,
        DATA_DIR: baseDataDir
    };
    delete workerEnv.PKG_EXECPATH;

    try {
        const workerLogPath = path.join(baseDataDir, `whatsapp-worker-${channel.id.substring(0, 8)}.log`);
        const workerLogStream = fs.openSync(workerLogPath, 'a');
        const spawnCwd = fs.existsSync(baseDataDir) ? baseDataDir : os.tmpdir();

        let worker;
        if (isPackaged && process.platform === 'win32') {
            // حل مشكلة PKG على ويندوز: pkg يحقن PKG_EXECPATH في childProcess.spawn تلقائياً،
            // مما يجعل العملية الفرعية تعتقد أنها node عادي يطلب تشغيل ملف خارجي وتفشل.
            // نستخدم سكربت تشغيل مصغر run-worker.cmd لمسح متغير PKG_EXECPATH قبل إقلاع الملف التنفيذي.
            const launcherPath = path.join(baseDataDir, 'run-worker.cmd');
            try {
                fs.writeFileSync(launcherPath, '@echo off\r\nset PKG_EXECPATH=\r\n"%~1"\r\n', 'utf8');
            } catch (e) {}

            worker = spawn(process.env.COMSPEC || 'cmd.exe', ['/c', launcherPath, process.execPath], {
                env: workerEnv,
                cwd: spawnCwd,
                stdio: ['ignore', workerLogStream, workerLogStream],
                detached: true,
                windowsHide: true
            });
        } else {
            const spawnArgs = isPackaged ? [] : [__filename];
            worker = spawn(process.execPath, spawnArgs, {
                env: workerEnv,
                cwd: spawnCwd,
                stdio: ['ignore', workerLogStream, workerLogStream],
                detached: true,
                windowsHide: true
            });
        }

        worker.on('error', (err) => {
            log('ERROR', `فشل في تشغيل العقدة الفرعية للقناة ${channel.name}: ${err.message}`);
            channelWorkers.delete(channel.id);
            try { fs.closeSync(workerLogStream); } catch(e) {}
        });

        worker.on('exit', (code, sig) => {
            log('WARN', `العقدة الفرعية للقناة ${channel.name} توقفت (كود: ${code}). راجع: ${workerLogPath}`);
            channelWorkers.delete(channel.id);
            try { fs.closeSync(workerLogStream); } catch(e) {}
            if (!isShuttingDown) {
                setTimeout(syncChannelWorkers, 8000);
            }
        });

        worker.unref();
        channelWorkers.set(channel.id, worker);
    } catch (err) {
        log('ERROR', `فشل تشغيل العقدة الفرعية للقناة ${channel.name}:`, err.message);
    }
}

function subscribeToChannels() {
    if (CHANNEL_ID) return;
    channelsSub = supabase
        .channel('master-channel-orchestrator')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'whatsapp_channels' },
            () => {
                syncChannelWorkers();
            }
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'system_settings',
                filter: 'key=eq.whatsapp_allow_multi_channel'
            },
            () => {
                log('INFO', '⚙️ رصد تعديل في إعداد السماح بتعدد القنوات على الجهاز. جارٍ المزامنة...');
                syncChannelWorkers();
            }
        )
        .subscribe();
    
    // فحص دوري كل دقيقة لضمان استمرار جميع قنوات المنظومة
    channelSyncTimer = setInterval(syncChannelWorkers, 60_000);
}

function subscribeToNodeAssignments() {
    if (process.env.CHANNEL_ID) return; // إذا كان مثبتاً كمتغير بيئة يدوي فيتجاهل التعيينات السحابية
    supabase
        .channel(`assignment-watch-${os.hostname()}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'whatsapp_node_assignments',
                filter: `hostname=eq.${os.hostname()}`
            },
            async (payload) => {
                const newTarget = payload.new?.target_channel_id || null;
                if (newTarget !== CHANNEL_ID) {
                    log('INFO', `🔄 رصد أمر إداري لتغيير القناة المخصصة لهذا الجهاز (${os.hostname()}): [${CHANNEL_ID}] ➔ [${newTarget}]`);
                    if (isLeader) {
                        try { await stepDown(false); } catch (e) {}
                    }
                    setTimeout(() => {
                        process.exit(0); // سيقوم مراقب تطبيق المزامنة بإعادة تشغيل العقدة بالقناة الجديدة
                    }, 1200);
                }
            }
        )
        .subscribe();
}

// ============================================================
// 10. ENTRY POINT (نقطة البداية)
// ============================================================

async function main() {
    // ✅ إصلاح #1: مزامنة اسم الشركة الصحيح قبل حساب NODE_ID لمنع ظهور الاسم الخاطئ
    if (!CHANNEL_ID) {
        await syncCompanyNameFromCloud(baseDataDir);
        // إعادة حساب NODE_ID بعد تحديث settings.json
        NODE_ID = resolveDeterministicNodeId(baseDataDir, CHANNEL_ID);
    }

    // 1. فحص التوجيه السحابي للقنوات إذا لم يُحدد CHANNEL_ID محلياً كمتغير بيئة
    if (!process.env.CHANNEL_ID) {
        try {
            const { data: assignment } = await supabase
                .from('whatsapp_node_assignments')
                .select('target_channel_id')
                .eq('hostname', os.hostname())
                .maybeSingle();

            if (assignment && assignment.target_channel_id) {
                recomputeChannelVariables(assignment.target_channel_id);
                log('INFO', `🎯 تم تحميل التوجيه السحابي المعتمد لهذا الجهاز (${os.hostname()}): يخدم القناة [${CHANNEL_ID}]`);
            }
        } catch (e) {
            log('WARN', 'تعذر فحص التوجيه السحابي للجهاز:', e.message);
        }
    }

    log('INFO', `========================================`);
    log('INFO', `   KWADER WhatsApp Node v2.4 Starting   `);
    log('INFO', `   Node ID: ${NODE_ID}`);
    log('INFO', `   Host: ${os.hostname()}`);
    if (CHANNEL_ID) {
        log('INFO', `   Dedicated Channel: ${process.env.CHANNEL_NAME || CHANNEL_ID}`);
    } else {
        log('INFO', `   Role: Master Node (Default Channel + Multi-Channel Orchestrator)`);
    }
    log('INFO', '════════════════════════════════════════');

    // ✅ إصلاح #2: تنظيف فوري للعقد القديمة عند الإقلاع لمنع الازدواجية في الداشبورد
    if (!CHANNEL_ID) {
        await bootCleanupStaleNodes();
    }

    subscribeToSettings();
    subscribeToNodeAssignments();
    subscribeToControlCommands();

    // تشغيل مراقب القنوات المتعددة للعقدة الرئيسية العامة فقط
    if (!CHANNEL_ID) {
        subscribeToChannels();
        setTimeout(syncChannelWorkers, 3000);
    }

    const acquired = await tryAcquireLock();

    if (acquired) {
        await becomeLeader();
    } else {
        startStandbyWatcher();
    }
}

// إجراءات الخروج النظيف وتحرير القفل
async function handleGracefulExit(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log('INFO', `تم استقبال إشارة الإيقاف (${signal}). جاري تحرير القفل وتسجيل إغلاق العقدة...`);
    try {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (standbyTimer) clearInterval(standbyTimer);
        if (pendingPollTimer) clearInterval(pendingPollTimer);

        if (typeof channelWorkers !== 'undefined') {
            for (const [id, worker] of channelWorkers.entries()) {
                terminateWorkerProcess(worker);
            }
        }

        if (isLeader) {
            await releaseLock(`graceful_exit_${signal}`);
        }
        await updateNodeTelemetry('offline');
    } catch (err) {
        log('WARN', 'تعذر إتمام عملية الخروج بالكامل:', err.message);
    }
    process.exit(0);
}

process.on('SIGINT', () => handleGracefulExit('SIGINT'));
process.on('SIGTERM', () => handleGracefulExit('SIGTERM'));

main().catch(err => {
    log('ERROR', 'خطأ فادح في التشغيل:', err);
    process.exit(1);
});
