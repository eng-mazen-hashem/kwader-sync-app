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
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return undefined;
}

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://olcrtfeobetvddocbmns.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_V-q33ausDk-VQmYXP3JzyA_0i6E3PiJ';

// معرف فريد لهذا الجهاز (Node ID)
const NODE_ID = `${os.hostname()}-${crypto.randomBytes(4).toString('hex')}`;

// المهل الزمنية (بالمللي ثانية)
const HEARTBEAT_INTERVAL_MS  = 45_000;  // 45 ثانية بين كل نبضة حياة
const LOCK_TIMEOUT_MS         = 120_000; // 2 دقيقة — إذا تجاوزها القائد يُعتبر ميتاً
const STANDBY_CHECK_MS        = 60_000;  // كل دقيقة يتحقق العملاء في الاستعداد من القفل
const PENDING_POLL_MS         = 30_000;  // كل 30 ثانية يتحقق القائد من رسائل pending قديمة

const baseDataDir = process.env.DATA_DIR || __dirname;
const sessionDir = path.join(baseDataDir, '.wwebjs_auth');
const zipPath    = path.join(baseDataDir, 'session_backup.zip');

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

let isLeader         = false;
let heartbeatTimer   = null;
let standbyTimer     = null;
let pendingPollTimer = null;
let waClient         = null;
let realtimeChannel  = null;
let isShuttingDown   = false;

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
// 1. SESSION MANAGEMENT
// ============================================================

async function restoreSession() {
    try {
        log('INFO', 'جارٍ استعادة جلسة الواتساب من قاعدة البيانات...');
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'whatsapp_session_zip')
            .single();

        if (error || !data?.value?.zip) {
            log('WARN', 'لا توجد جلسة محفوظة. سيتم عرض QR Code لتسجيل الدخول.');
            return false;
        }

        const buffer = Buffer.from(data.value.zip, 'base64');
        fs.writeFileSync(zipPath, buffer);

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(__dirname, true);

        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        log('SUCCESS', 'تم استعادة الجلسة بنجاح!');
        return true;
    } catch (err) {
        log('ERROR', 'خطأ في استعادة الجلسة:', err.message);
        return false;
    }
}

async function backupSession() {
    try {
        if (!fs.existsSync(sessionDir)) {
            log('WARN', 'مجلد الجلسة غير موجود. تخطي النسخ الاحتياطي.');
            return;
        }
        log('INFO', 'جارٍ نسخ الجلسة احتياطياً إلى قاعدة البيانات...');
        const zip = new AdmZip();
        
        // Add files recursively but exclude Cache folders to reduce size
        function addFolderToZip(folderPath, zipPath) {
            let items = [];
            try { items = fs.readdirSync(folderPath); } catch (e) { return; }
            for (const item of items) {
                const fullPath = path.join(folderPath, item);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        if (item.toLowerCase().includes('cache')) continue; // Skip Cache, Code Cache, GPUCache, etc.
                        if (item === 'IndexedDB') continue; // Skip IndexedDB (too large for Supabase payload)
                        addFolderToZip(fullPath, zipPath ? `${zipPath}/${item}` : item);
                    } else {
                        try {
                            const content = fs.readFileSync(fullPath);
                            zip.addFile(zipPath ? `${zipPath}/${item}` : item, content);
                        } catch(err) {
                            // Ignore EBUSY or locked files on Windows
                        }
                    }
                } catch (e) {
                    // Ignore stat errors
                }
            }
        }
        
        addFolderToZip(sessionDir, '');
        zip.writeZip(zipPath);

        const buffer = fs.readFileSync(zipPath);
        const base64 = buffer.toString('base64');

        const { error } = await supabase
            .from('system_settings')
            .upsert({
                key: 'whatsapp_session_zip',
                value: { zip: base64, backup_node: NODE_ID },
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

        if (error) throw error;
        log('SUCCESS', 'تم حفظ نسخة الجلسة بنجاح في قاعدة البيانات!');
    } catch (err) {
        log('ERROR', 'خطأ في نسخ الجلسة:', err.message);
    }
}

// ============================================================
// 2. LEADER ELECTION (Lock System)
// ============================================================

async function tryAcquireLock() {
    try {
        const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'whatsapp_lock')
            .single();

        const now = Date.now();

        if (data?.value?.node_id && data.value.node_id !== NODE_ID) {
            const lastBeat = new Date(data.value.last_heartbeat).getTime();
            const age      = now - lastBeat;

            if (age < LOCK_TIMEOUT_MS) {
                log('STANDBY', `القائد النشط: ${data.value.node_id} (منذ ${Math.round(age / 1000)}ث)`);
                return false;
            }
            log('WARN', `القائد ${data.value.node_id} انقطع (منذ ${Math.round(age / 1000)}ث). جارٍ الاستحواذ...`);
        }

        const { error } = await supabase
            .from('system_settings')
            .upsert({
                key: 'whatsapp_lock',
                value: {
                    node_id:        NODE_ID,
                    last_heartbeat: new Date().toISOString(),
                    acquired_at:    new Date().toISOString()
                },
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) throw error;
        log('LEADER', '✨ تم الاستحواذ على قفل القيادة!');
        return true;
    } catch (err) {
        log('ERROR', 'خطأ في نظام القفل:', err.message);
        return false;
    }
}

async function releaseLock() {
    try {
        await supabase
            .from('system_settings')
            .upsert({
                key: 'whatsapp_lock',
                value: {
                    node_id:        null,
                    last_heartbeat: null,
                    released_at:    new Date().toISOString(),
                    released_by:    NODE_ID
                },
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        log('INFO', 'تم تحرير قفل القيادة.');
    } catch (err) {
        log('ERROR', 'خطأ في تحرير القفل:', err.message);
    }
}

// ============================================================
// 3. HEARTBEAT (نبضات الحياة)
// ============================================================

function startHeartbeat() {
    heartbeatTimer = setInterval(async () => {
        if (!isLeader || isShuttingDown) return;
        try {
            await supabase
                .from('system_settings')
                .upsert({
                    key: 'whatsapp_lock',
                    value: {
                        node_id:        NODE_ID,
                        last_heartbeat: new Date().toISOString()
                    },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
        } catch (err) {
            log('ERROR', 'فشل إرسال نبضة الحياة:', err.message);
        }
    }, HEARTBEAT_INTERVAL_MS);
    log('LEADER', `نظام نبضات الحياة نشط (كل ${HEARTBEAT_INTERVAL_MS / 1000}ث)`);
}

// ============================================================
// 4. STANDBY WATCHER (مراقبة القفل في وضع الانتظار)
// ============================================================

function startStandbyWatcher() {
    standbyTimer = setInterval(async () => {
        if (isLeader || isShuttingDown) return;
        log('STANDBY', 'فحص قفل القيادة...');
        const acquired = await tryAcquireLock();
        if (acquired) {
            clearInterval(standbyTimer);
            standbyTimer = null;
            await becomeLeader();
        }
    }, STANDBY_CHECK_MS);
    log('STANDBY', `مراقبة القفل (كل ${STANDBY_CHECK_MS / 1000}ث). في وضع الانتظار...`);
}

// ============================================================
// 5. MESSAGE PROCESSING (معالجة الرسائل)
// ============================================================

async function processMessage(record) {
    const { id, phone, message, pdf_url } = record;
    log('LEADER', `معالجة رسالة #${id} → ${phone}`);

    // تحديث الحالة إلى "جارٍ الإرسال" لمنع المعالجة المزدوجة
    await supabase
        .from('whatsapp_queue')
        .update({ status: 'sending', node_id: NODE_ID })
        .eq('id', id)
        .eq('status', 'pending');

    try {
        if (!waClient?.info) {
            throw new Error('عميل الواتساب غير جاهز بعد');
        }

        const formattedPhone = phone.replace(/\D/g, '');
        const chatId = `${formattedPhone}@c.us`;

        if (pdf_url) {
            const media = await MessageMedia.fromUrl(pdf_url, { unsafeMime: true });
            await waClient.sendMessage(chatId, media, { caption: message || '' });
        } else {
            await waClient.sendMessage(chatId, message);
        }

        await supabase
            .from('whatsapp_queue')
            .update({
                status:       'sent',
                processed_at: new Date().toISOString(),
                node_id:      NODE_ID
            })
            .eq('id', id);

        log('SUCCESS', `تم إرسال الرسالة #${id} بنجاح إلى ${chatId}`);
    } catch (err) {
        log('ERROR', `فشل إرسال الرسالة #${id}:`, err.message);

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

// معالجة الرسائل المتراكمة (شبكة أمان)
async function processPendingMessages() {
    if (!isLeader || !waClient?.info) return;
    try {
        const { data: pending } = await supabase
            .from('whatsapp_queue')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(10);

        if (pending && pending.length > 0) {
            log('LEADER', `وجدت ${pending.length} رسالة pending. جارٍ المعالجة...`);
            for (const msg of pending) {
                await processMessage(msg);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    } catch (err) {
        log('ERROR', 'خطأ في فحص الرسائل المتراكمة:', err.message);
    }
}

// ============================================================
// 6. REALTIME SUBSCRIPTION (الاشتراك في الأحداث الفورية)
// ============================================================

function subscribeToQueue() {
    realtimeChannel = supabase
        .channel('whatsapp-queue-changes')
        .on(
            'postgres_changes',
            {
                event:  'INSERT',
                schema: 'public',
                table:  'whatsapp_queue',
                filter: 'status=eq.pending'
            },
            async (payload) => {
                if (!isLeader) return;
                log('LEADER', `📨 رسالة جديدة عبر Realtime! ID: ${payload.new.id}`);
                setTimeout(() => processMessage(payload.new), 500);
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                log('LEADER', '📡 مشترك في طابور الرسائل. جاهز للاستماع!');
                processPendingMessages();
            }
        });
}

// ============================================================
// 7. WHATSAPP CLIENT (عميل الواتساب)
// ============================================================

async function initWhatsApp() {
    log('LEADER', 'جارٍ تهيئة عميل الواتساب...');

    await restoreSession();

    waClient = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            executablePath: findBrowser(),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
                '--memory-pressure-off'
            ]
        }
    });

    waClient.on('qr', (qr) => {
        log('WARN', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('WARN', 'يجب مسح QR Code لتسجيل الدخول!');
        log('WARN', 'قم بفتح http://localhost:3001 لمسح الكود.');
        log('WARN', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // حفظ QR في DB
        supabase.from('system_settings').upsert({
            key: 'whatsapp_qr_pending',
            value: { qr, node_id: NODE_ID, timestamp: new Date().toISOString() },
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' }).then(() => {});
    });

    waClient.on('ready', () => {
        log('SUCCESS', '🟢 عميل الواتساب جاهز! بدء الاستماع للطابور...');
        setTimeout(backupSession, 10_000);
        subscribeToQueue();
        pendingPollTimer = setInterval(processPendingMessages, PENDING_POLL_MS);
    });

    waClient.on('authenticated', () => {
        log('SUCCESS', '🔐 تم التحقق من الواتساب بنجاح!');
        setTimeout(backupSession, 10_000);
    });

    waClient.on('auth_failure', (msg) => {
        log('ERROR', 'فشل التحقق من الواتساب:', msg);
    });

    waClient.on('disconnected', async (reason) => {
        log('WARN', 'انقطع الاتصال بالواتساب. السبب:', reason);
        if (!isShuttingDown) {
            log('INFO', 'إعادة تهيئة العميل بعد 30 ثانية...');
            setTimeout(async () => {
                try { await waClient.initialize(); } catch (e) { log('ERROR', 'فشلت إعادة التهيئة:', e.message); }
            }, 30_000);
        }
    });

    await waClient.initialize();
}

// ============================================================
// 8. BECOME LEADER (الانتقال لحالة القيادة)
// ============================================================

async function becomeLeader() {
    isLeader = true;
    log('LEADER', '══════════════════════════════════');
    log('LEADER', `هذا الجهاز أصبح القائد النشط!`);
    log('LEADER', `Node ID: ${NODE_ID}`);
    log('LEADER', '══════════════════════════════════');
    startHeartbeat();
    await initWhatsApp();
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

    if (realtimeChannel) {
        await supabase.removeChannel(realtimeChannel);
    }

    if (isLeader) {
        await releaseLock();
        log('INFO', 'تم تحرير القفل. عميل آخر سيستحوذ في الدورة القادمة.');
    }

    if (waClient) {
        try { await waClient.destroy(); } catch (e) {}
    }

    log('SUCCESS', 'تم الإغلاق الآمن بنجاح. وداعاً!');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGQUIT', () => shutdown('SIGQUIT'));

// ============================================================
// 10. ENTRY POINT (نقطة البداية)
// ============================================================

async function main() {
    log('INFO', '════════════════════════════════════════');
    log('INFO', '   KWADER WhatsApp Node v2.0 Starting   ');
    log('INFO', `   Node ID: ${NODE_ID}`);
    log('INFO', '════════════════════════════════════════');

    const acquired = await tryAcquireLock();

    if (acquired) {
        await becomeLeader();
    } else {
        startStandbyWatcher();
    }
}

main().catch(err => {
    log('ERROR', 'خطأ فادح في التشغيل:', err);
    process.exit(1);
});
