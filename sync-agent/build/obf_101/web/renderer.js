const api = () => (window.pywebview && window.pywebview.api ? window.pywebview.api : null);

// UI Elements
const logsView = document.getElementById('logsView');
const statusBadge = document.getElementById('statusBadge');
const bigStatusIcon = document.getElementById('bigStatusIcon');
const bigStatusText = document.getElementById('bigStatusText');
const lastSyncText = document.getElementById('lastSyncText');
const toggleSyncBtn = document.getElementById('toggleSyncBtn');
const forceSyncBtn = document.getElementById('forceSyncBtn');
const settingsForm = document.getElementById('settingsForm');
const verifyLicenseBtn = document.getElementById('verifyLicenseBtn');
const licenseStatus = document.getElementById('licenseStatus');
const resetSyncBtn = document.getElementById('resetSyncBtn');

// Demo Mode Elements
const demoModeToggle = document.getElementById('demoModeToggle');
const demoModeLabel = document.getElementById('demoModeLabel');
const demoHint = document.getElementById('demoHint');
const genHistoricalBtn = document.getElementById('genHistoricalBtn');
const deviceSettingsSection = document.getElementById('deviceSettingsSection');

// Auto-Start Element
const autoStartToggle = document.getElementById('autoStartToggle');
const autoStartLabel = document.getElementById('autoStartLabel');

const inputs = {
    licenseKey: document.getElementById('licenseKey'),
    deviceIp: document.getElementById('deviceIp'),
    devicePort: document.getElementById('devicePort'),
    deviceSn: document.getElementById('deviceSn'),
    syncInterval: document.getElementById('syncInterval')
};

let isSyncing = false;
let isDemoMode = false;

// ==========================================
// Tab Switching
// ==========================================
window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.getElementById(`${tabId}Tab`).classList.add('active');
    event.currentTarget.classList.add('active');
};

// ==========================================
// Init
// ==========================================
async function init() {
    const apiRef = api();
    if (!apiRef) return;

    const settings = await apiRef.get_settings();
    Object.keys(inputs).forEach(k => { if (settings[k]) inputs[k].value = settings[k]; });

    const status = await apiRef.get_status();
    isSyncing = status.isSyncing;
    isDemoMode = status.demoMode || false;
    updateStatusUI();
    updateDemoUI(isDemoMode);
    if (status.lastSync) lastSyncText.innerText = `آخر مزامنة: ${status.lastSync}`;

    const autoStart = await apiRef.get_auto_start();
    updateAutoStartUI(autoStart);
}

// ==========================================
// Auto-Start (Startup with Windows)
// ==========================================
autoStartToggle.addEventListener('change', async () => {
    const enabled = autoStartToggle.checked;
    await api().set_auto_start(enabled);
    updateAutoStartUI(enabled);
});

function updateAutoStartUI(enabled) {
    autoStartToggle.checked = enabled;
    if (autoStartLabel) {
        autoStartLabel.innerText = enabled ? 'مفعّل' : 'معطّل';
        autoStartLabel.style.color = enabled ? '#4ade80' : '';
    }
}

// ==========================================
// Demo Mode Controls
// ==========================================
demoModeToggle.addEventListener('change', async () => {
    const enabled = demoModeToggle.checked;
    await api().toggle_demo_mode(enabled);
    isDemoMode = enabled;
    updateDemoUI(enabled);
    updateStatusUI();
});

genHistoricalBtn.addEventListener('click', async () => {
    genHistoricalBtn.disabled = true;
    genHistoricalBtn.innerText = 'جاري التوليد...';
    try {
        await api().generate_historical();
    } finally {
        genHistoricalBtn.disabled = false;
        genHistoricalBtn.innerText = 'توليد بيانات 7 أيام';
    }
});

function updateDemoUI(enabled) {
    demoModeToggle.checked = enabled;
    if (enabled) {
        demoModeLabel.innerText = 'نشط';
        demoModeLabel.style.color = '#a78bfa';
        demoHint.style.display = 'block';
        deviceSettingsSection.style.opacity = '0.4';
        deviceSettingsSection.style.pointerEvents = 'none';
    } else {
        demoModeLabel.innerText = 'معطّل';
        demoModeLabel.style.color = '';
        demoHint.style.display = 'none';
        deviceSettingsSection.style.opacity = '1';
        deviceSettingsSection.style.pointerEvents = 'auto';
    }
}

window.onDemoModeChanged = (enabled) => {
    isDemoMode = enabled;
    updateDemoUI(enabled);
    updateStatusUI();
};

window.onSyncStateChanged = (syncing) => {
    isSyncing = syncing;
    updateStatusUI();
};

// ==========================================
// Verify License
// ==========================================
verifyLicenseBtn.addEventListener('click', async () => {
    const key = inputs.licenseKey.value.trim();
    if (!key) {
        licenseStatus.className = 'license-status invalid';
        licenseStatus.innerText = 'أدخل مفتاح الترخيص أولاً';
        return;
    }

    verifyLicenseBtn.disabled = true;
    verifyLicenseBtn.innerText = '...';
    licenseStatus.className = 'license-status';
    licenseStatus.innerText = 'جاري التحقق...';

    const result = await api().verify_license(key);

    if (result.valid) {
        licenseStatus.className = 'license-status valid';
        licenseStatus.innerText = `ترخيص صالح — ${result.companyName}`;
    } else {
        licenseStatus.className = 'license-status invalid';
        licenseStatus.innerText = `خطأ: ${result.message}`;
    }
    verifyLicenseBtn.disabled = false;
    verifyLicenseBtn.innerText = 'تحقق';
});

// ==========================================
// Save Settings
// ==========================================
settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const obj = {};
    Object.keys(inputs).forEach(k => obj[k] = inputs[k].value);
    await api().save_settings(obj);
});

// ==========================================
// Sync Controls
// ==========================================
toggleSyncBtn.addEventListener('click', async () => {
    if (isSyncing) {
        await api().stop_sync();
        isSyncing = false;
    } else {
        await api().start_sync();
        isSyncing = true;
    }
    updateStatusUI();
});

forceSyncBtn.addEventListener('click', async () => {
    forceSyncBtn.disabled = true;
    forceSyncBtn.innerText = 'جاري...';
    try {
        const t = await api().force_sync();
        lastSyncText.innerText = `آخر مزامنة: ${t}`;
    } finally {
        forceSyncBtn.disabled = false;
        forceSyncBtn.innerText = 'مزامنة الآن';
    }
});

resetSyncBtn.addEventListener('click', async () => {
    if (confirm('هل أنت متأكد من رغبتك في إعادة رفع كافة سجلات البصمة؟\n\nسيتم اعتبار كافة السجلات الموجودة على الجهاز "جديدة" وإرسالها للسحابة في المزامنة القادمة.')) {
        const success = await api().reset_sync_for_license();
        if (success) {
            lastSyncText.innerText = 'بانتظار إعادة الرفع...';
        }
    }
});

// ==========================================
// Status UI
// ==========================================
function updateStatusUI() {
    if (isSyncing) {
        toggleSyncBtn.innerText = 'إيقاف';
        toggleSyncBtn.className = 'btn btn-secondary btn-lg';

        if (isDemoMode) {
            statusBadge.innerText = 'تجريبي';
            statusBadge.className = 'badge badge-demo';
            bigStatusIcon.innerText = '🧪';
            bigStatusText.innerText = 'المزامنة التجريبية نشطة';
        } else {
            statusBadge.innerText = 'نشط';
            statusBadge.className = 'badge badge-success';
            bigStatusIcon.innerText = '✓';
            bigStatusText.innerText = 'المزامنة التلقائية نشطة';
        }
    } else {
        toggleSyncBtn.innerText = 'بدء المزامنة';
        toggleSyncBtn.className = 'btn btn-primary btn-lg';

        if (isDemoMode) {
            statusBadge.innerText = 'تجريبي (متوقف)';
            statusBadge.className = 'badge badge-demo';
            bigStatusIcon.innerText = '🧪';
            bigStatusText.innerText = 'وضع التجربة (متوقف)';
        } else {
            statusBadge.innerText = 'متوقف';
            statusBadge.className = 'badge badge-neutral';
            bigStatusIcon.innerText = '⏸';
            bigStatusText.innerText = 'المزامنة متوقفة';
        }
    }
}

// ==========================================
// Log Messages
// ==========================================
window.onPythonLog = ({ message, type }) => {
    const el = document.createElement('div');
    el.className = `log-entry ${type}`;
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    el.innerText = `[${t}] ${message}`;
    logsView.appendChild(el);
    while (logsView.children.length > 200) logsView.removeChild(logsView.firstChild);
    logsView.scrollTop = logsView.scrollHeight;
};

window.onSyncCompleted = (time) => {
    lastSyncText.innerText = `آخر مزامنة: ${time}`;
};

if (window.pywebview) {
    init();
} else {
    window.addEventListener('pywebviewready', init);
}
