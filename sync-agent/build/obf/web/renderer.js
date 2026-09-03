const api = () => (window.pywebview && window.pywebview.api ? window.pywebview.api : null);

const logsView = document.getElementById('logsView');
const statusBadge = document.getElementById('statusBadge');
const bigStatusIcon = document.getElementById('bigStatusIcon');
const bigStatusText = document.getElementById('bigStatusText');
const lastSyncText = document.getElementById('lastSyncText');
const toggleSyncBtn = document.getElementById('toggleSyncBtn');
const forceSyncBtn = document.getElementById('forceSyncBtn');
const settingsForm = document.getElementById('settingsForm');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const saveToast = document.getElementById('saveToast');
const verifyLicenseBtn = document.getElementById('verifyLicenseBtn');
const licenseStatus = document.getElementById('licenseStatus');
const resetSyncBtn = document.getElementById('resetSyncBtn');
const languageToggle = document.getElementById('languageToggle');

const autoStartToggle = document.getElementById('autoStartToggle');
const autoStartLabel = document.getElementById('autoStartLabel');

const inputs = {
  licenseKey: document.getElementById('licenseKey'),
  deviceIp: document.getElementById('deviceIp'),
  devicePort: document.getElementById('devicePort'),
  deviceSn: document.getElementById('deviceSn'),
  syncInterval: document.getElementById('syncInterval'),
  hikPort: document.getElementById('hikPort'),
  hikUsername: document.getElementById('hikUsername'),
  hikPassword: document.getElementById('hikPassword'),
  deviceSnHik: document.getElementById('deviceSnHik')
};

const deviceTypeZK = document.getElementById('deviceTypeZK');
const deviceTypeHik = document.getElementById('deviceTypeHik');
const zkFields = document.getElementById('zkteco-fields');
const hikFields = document.getElementById('hikvision-fields');
const hikHttps = document.getElementById('hikHttps');
const hikConnStatus = document.getElementById('hikConnStatus');
const testHikBtn = document.getElementById('testHikBtn');

let isSyncing = false;
let currentDeviceType = 'zkteco';
let saveToastTimer = null;
let currentLanguage = 'ar';
let currentLastSync = '';

const translations = {
  ar: {
    appTitle: 'KWADER Sync Agent',
    appSubtitle: 'مزامنة احترافية لأجهزة الحضور',
    dashboard: 'لوحة التحكم',
    settings: 'الإعدادات',
    stopped: 'متوقف',
    active: 'نشط',
    syncStopped: 'المزامنة متوقفة',
    syncRunning: 'المزامنة تعمل الآن',
    noSyncYet: 'لا توجد مزامنة بعد',
    lastSync: 'آخر مزامنة: {time}',
    startSync: 'بدء المزامنة',
    stopSync: 'إيقاف المزامنة',
    syncNow: 'مزامنة الآن',
    running: 'جار التشغيل...',
    resetWatermark: 'إعادة الضبط',
    resetWatermarkTitle: 'إعادة ضبط علامة المزامنة ورفع كل السجلات مرة أخرى',
    eventLog: 'سجل الأحداث',
    clear: 'مسح',
    readyLog: '[بدء] جاهز. اضبط الإعدادات ثم شغّل المزامنة.',
    licenseKey: 'مفتاح الترخيص',
    licenseHelp: 'أدخل مفتاح ترخيص الشركة وتحقق من الاتصال.',
    verify: 'تحقق',
    verifying: 'جار التحقق...',
    licenseRequired: 'مفتاح الترخيص مطلوب.',
    validLicense: 'ترخيص صالح - {company}',
    error: 'خطأ: {message}',
    verificationFailed: 'فشل التحقق',
    deviceSettings: 'إعدادات الجهاز',
    deviceHelp: 'اختر نوع الجهاز وأدخل بيانات الشبكة.',
    deviceIp: 'عنوان IP للجهاز',
    port: 'المنفذ',
    deviceSerial: 'رقم الجهاز (S/N)',
    optional: 'اختياري',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    useHttps: 'استخدام HTTPS',
    ready: 'جاهز',
    testConnection: 'اختبار الاتصال',
    testing: 'جار الاختبار...',
    testingConnection: 'جار اختبار الاتصال...',
    connectionFailed: 'فشل الاتصال',
    startupSync: 'التشغيل والمزامنة',
    startupHelp: 'إعدادات التشغيل التلقائي وفترة المزامنة.',
    enabled: 'مفعل',
    disabled: 'معطل',
    syncInterval: 'فترة المزامنة (بالدقائق)',
    saveSettings: 'حفظ الإعدادات',
    settingsSaved: 'تم حفظ الإعدادات بنجاح',
    waitingFullUpload: 'بانتظار الرفع الكامل التالي...',
    resetConfirm: 'هل تريد إعادة ضبط علامة المزامنة ورفع كل السجلات في المزامنة التالية؟',
    languageToggle: 'English'
  },
  en: {
    appTitle: 'KWADER Sync Agent',
    appSubtitle: 'Professional attendance device synchronization',
    dashboard: 'Dashboard',
    settings: 'Settings',
    stopped: 'Stopped',
    active: 'Active',
    syncStopped: 'Synchronization is stopped',
    syncRunning: 'Synchronization is running',
    noSyncYet: 'No sync yet',
    lastSync: 'Last sync: {time}',
    startSync: 'Start Sync',
    stopSync: 'Stop Sync',
    syncNow: 'Sync Now',
    running: 'Running...',
    resetWatermark: 'Reset Watermark',
    resetWatermarkTitle: 'Reset sync watermark and re-upload all records',
    eventLog: 'Event Log',
    clear: 'Clear',
    readyLog: '[START] Ready. Configure your settings and run sync.',
    licenseKey: 'License Key',
    licenseHelp: 'Enter your company license key and verify connection.',
    verify: 'Verify',
    verifying: 'Verifying...',
    licenseRequired: 'License key is required.',
    validLicense: 'Valid license - {company}',
    error: 'Error: {message}',
    verificationFailed: 'Verification failed',
    deviceSettings: 'Device Settings',
    deviceHelp: 'Select device type and fill network credentials.',
    deviceIp: 'Device IP Address',
    port: 'Port',
    deviceSerial: 'Device Serial (S/N)',
    optional: 'Optional',
    username: 'Username',
    password: 'Password',
    useHttps: 'Use HTTPS',
    ready: 'Ready',
    testConnection: 'Test Connection',
    testing: 'Testing...',
    testingConnection: 'Testing connection...',
    connectionFailed: 'Connection failed',
    startupSync: 'Startup & Sync',
    startupHelp: 'Auto-start behavior and sync interval.',
    enabled: 'Enabled',
    disabled: 'Disabled',
    syncInterval: 'Sync Interval (minutes)',
    saveSettings: 'Save Settings',
    settingsSaved: 'Settings saved successfully',
    waitingFullUpload: 'Waiting for next full upload...',
    resetConfirm: 'Reset sync watermark and re-upload all records on next sync?',
    languageToggle: 'العربية'
  }
};

function t(key, values = {}) {
  let text = (translations[currentLanguage] && translations[currentLanguage][key]) || translations.en[key] || key;
  Object.entries(values).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, value);
  });
  return text;
}

function applyLanguage(language) {
  currentLanguage = language === 'en' ? 'en' : 'ar';
  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.innerText = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((node) => {
    node.title = t(node.dataset.i18nTitle);
  });

  if (languageToggle) languageToggle.innerText = t('languageToggle');
  updateStatusUI();
  updateAutoStartUI(autoStartToggle ? autoStartToggle.checked : false);
  renderLastSync();
}

function renderLastSync() {
  if (!lastSyncText) return;
  const lastSync = cleanText(currentLastSync);
  lastSyncText.innerText = !lastSync || lastSync === 'No sync yet' ? t('noSyncYet') : t('lastSync', { time: lastSync });
}

function cleanText(input) {
  const text = String(input ?? '');
  return text
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\uFFFD]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function showSaveSuccess() {
  if (!saveSettingsBtn || !saveToast) return;

  saveSettingsBtn.classList.remove('saving', 'saved');
  saveSettingsBtn.classList.add('saving');

  setTimeout(() => {
    saveSettingsBtn.classList.remove('saving');
    saveSettingsBtn.classList.add('saved');
  }, 140);

  saveToast.classList.add('show');
  clearTimeout(saveToastTimer);
  saveToastTimer = setTimeout(() => {
    saveToast.classList.remove('show');
    saveSettingsBtn.classList.remove('saved');
  }, 2200);
}

function switchDeviceType(type) {
  currentDeviceType = type;

  if (type === 'hikvision') {
    zkFields.style.display = 'none';
    hikFields.style.display = 'block';
    document.getElementById('btnHikvision').classList.add('active');
    document.getElementById('btnZKTeco').classList.remove('active');
  } else {
    zkFields.style.display = 'block';
    hikFields.style.display = 'none';
    document.getElementById('btnZKTeco').classList.add('active');
    document.getElementById('btnHikvision').classList.remove('active');
  }
}

[deviceTypeZK, deviceTypeHik].forEach((radio) => {
  if (radio) radio.addEventListener('change', () => switchDeviceType(radio.value));
});

window.switchTab = (tabId, btn) => {
  document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));

  const tab = document.getElementById(`${tabId}Tab`);
  if (tab) tab.classList.add('active');
  if (btn && btn.classList) btn.classList.add('active');
};

async function init() {
  const apiRef = api();
  if (!apiRef) return;

  const settings = await apiRef.get_settings();
  applyLanguage(settings.language || 'ar');
  ['licenseKey', 'deviceIp', 'devicePort', 'deviceSn', 'syncInterval'].forEach((key) => {
    if (inputs[key] && settings[key] !== undefined) inputs[key].value = settings[key];
  });

  if (inputs.hikPort && settings.hikPort !== undefined) inputs.hikPort.value = settings.hikPort;
  if (inputs.hikUsername && settings.hikUsername !== undefined) inputs.hikUsername.value = settings.hikUsername;
  if (inputs.hikPassword && settings.hikPassword !== undefined) inputs.hikPassword.value = settings.hikPassword;
  if (inputs.deviceSnHik && settings.deviceSn !== undefined) inputs.deviceSnHik.value = settings.deviceSn;
  if (hikHttps) hikHttps.checked = !!settings.hikHttps;

  const devType = settings.deviceType || 'zkteco';
  if (devType === 'hikvision' && deviceTypeHik) deviceTypeHik.checked = true;
  if (devType !== 'hikvision' && deviceTypeZK) deviceTypeZK.checked = true;
  switchDeviceType(devType);

  const status = await apiRef.get_status();
  isSyncing = !!status.isSyncing;
  updateStatusUI();
  if (status.lastSync) {
    currentLastSync = cleanText(status.lastSync);
    renderLastSync();
  }

  const autoStart = await apiRef.get_auto_start();
  updateAutoStartUI(autoStart);
}

if (languageToggle) {
  languageToggle.addEventListener('click', async () => {
    const nextLanguage = currentLanguage === 'ar' ? 'en' : 'ar';
    applyLanguage(nextLanguage);
    const apiRef = api();
    if (apiRef && apiRef.set_language) {
      await apiRef.set_language(nextLanguage);
    }
  });
}

autoStartToggle.addEventListener('change', async () => {
  const enabled = autoStartToggle.checked;
  await api().set_auto_start(enabled);
  updateAutoStartUI(enabled);
});

function updateAutoStartUI(enabled) {
  autoStartToggle.checked = !!enabled;
  autoStartLabel.innerText = enabled ? t('enabled') : t('disabled');
  autoStartLabel.style.color = enabled ? 'var(--success)' : '';
}

window.onSyncStateChanged = (syncing) => {
  isSyncing = !!syncing;
  updateStatusUI();
};

verifyLicenseBtn.addEventListener('click', async () => {
  const key = inputs.licenseKey.value.trim();
  if (!key) {
    licenseStatus.innerText = t('licenseRequired');
    licenseStatus.style.color = 'var(--danger)';
    return;
  }

  verifyLicenseBtn.disabled = true;
  verifyLicenseBtn.innerText = '...';
  licenseStatus.style.color = 'var(--muted)';
  licenseStatus.innerText = t('verifying');

  try {
    const result = await api().verify_license(key);
    if (result && result.valid) {
      licenseStatus.style.color = 'var(--success)';
      licenseStatus.innerText = t('validLicense', { company: cleanText(result.companyName) });
    } else {
      licenseStatus.style.color = 'var(--danger)';
      licenseStatus.innerText = t('error', { message: cleanText(result ? result.message : t('verificationFailed')) });
    }
  } finally {
    verifyLicenseBtn.disabled = false;
    verifyLicenseBtn.innerText = t('verify');
  }
});

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {};
  ['licenseKey', 'deviceIp', 'devicePort', 'syncInterval'].forEach((key) => {
    payload[key] = inputs[key] ? inputs[key].value : '';
  });

  payload.deviceSn =
    currentDeviceType === 'hikvision'
      ? (inputs.deviceSnHik ? inputs.deviceSnHik.value : '')
      : (inputs.deviceSn ? inputs.deviceSn.value : '');

  payload.deviceType = currentDeviceType;
  payload.hikPort = inputs.hikPort ? inputs.hikPort.value : 80;
  payload.hikUsername = inputs.hikUsername ? inputs.hikUsername.value : 'admin';
  payload.hikPassword = inputs.hikPassword ? inputs.hikPassword.value : '';
  payload.hikHttps = hikHttps ? hikHttps.checked : false;

  saveSettingsBtn.disabled = true;
  try {
    await api().save_settings(payload);
    showSaveSuccess();
  } finally {
    saveSettingsBtn.disabled = false;
  }
});

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
  forceSyncBtn.innerText = t('running');
  try {
    const time = await api().force_sync();
    currentLastSync = cleanText(time);
    renderLastSync();
  } finally {
    forceSyncBtn.disabled = false;
    forceSyncBtn.innerText = t('syncNow');
  }
});

resetSyncBtn.addEventListener('click', async () => {
  const ok = confirm(t('resetConfirm'));
  if (!ok) return;

  const success = await api().reset_sync_for_license();
  if (success) {
    currentLastSync = '';
    lastSyncText.innerText = t('waitingFullUpload');
  }
});

if (hikHttps) {
  hikHttps.addEventListener('change', () => {
    const portInput = inputs.hikPort;
    if (portInput) {
      if (hikHttps.checked && portInput.value === '80') {
        portInput.value = '443';
      } else if (!hikHttps.checked && portInput.value === '443') {
        portInput.value = '80';
      }
    }
  });
}

if (testHikBtn) {
  testHikBtn.addEventListener('click', async () => {
    testHikBtn.disabled = true;
    testHikBtn.innerText = t('testing');
    hikConnStatus.style.color = 'var(--muted)';
    hikConnStatus.innerText = t('testingConnection');

    try {
      const result = await api().test_hikvision_connection();
      if (result && result.success) {
        hikConnStatus.style.color = 'var(--success)';
        hikConnStatus.innerText = cleanText(result.message);
      } else {
        hikConnStatus.style.color = 'var(--danger)';
        hikConnStatus.innerText = cleanText(result ? result.message : t('connectionFailed'));
      }
    } catch (err) {
      hikConnStatus.style.color = 'var(--danger)';
      hikConnStatus.innerText = t('error', { message: cleanText(err) });
    } finally {
      testHikBtn.disabled = false;
      testHikBtn.innerText = t('testConnection');
    }
  });
}

function updateStatusUI() {
  if (isSyncing) {
    toggleSyncBtn.innerText = t('stopSync');
    toggleSyncBtn.className = 'btn btn-secondary';
    statusBadge.innerText = t('active');
    statusBadge.className = 'status-badge badge-success';
    bigStatusIcon.innerText = 'OK';
    bigStatusText.innerText = t('syncRunning');
  } else {
    toggleSyncBtn.innerText = t('startSync');
    toggleSyncBtn.className = 'btn btn-primary';
    statusBadge.innerText = t('stopped');
    statusBadge.className = 'status-badge badge-neutral';
    bigStatusIcon.innerText = '||';
    bigStatusText.innerText = t('syncStopped');
  }
}

window.onPythonLog = ({ message, type }) => {
  const row = document.createElement('div');
  row.className = `log-entry ${type}`;
  const now = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const safe = cleanText(message);
  row.innerText = `[${now}] ${safe}`;
  logsView.appendChild(row);

  while (logsView.children.length > 250) {
    logsView.removeChild(logsView.firstChild);
  }

  logsView.scrollTop = logsView.scrollHeight;
};

window.onSyncCompleted = (time) => {
  currentLastSync = cleanText(time);
  renderLastSync();
};

if (window.pywebview) {
  init();
} else {
  window.addEventListener('pywebviewready', init);
}
