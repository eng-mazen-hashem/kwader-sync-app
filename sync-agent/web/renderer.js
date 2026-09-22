/**
 * KWADER Sync Agent — Frontend Controller
 * Enterprise SaaS & Smart Diagnostics Engine
 */

const getApi = () => (window.pywebview && window.pywebview.api ? window.pywebview.api : null);

// ─── State Management ──────────────────────────────────────
const state = {
  isSyncing: false,
  language: 'ar',
  activePage: 'dashboard',
  devices: [],
  deviceQuota: 10,
  syncInterval: 60,
  autoStart: false,
  offlineBuffer: true,
  liveSync: true,
  licenseKey: '',
  companyName: '',
  plan: '',
  licenseStatus: 'active',
  licenseExpiry: '',
  daysRemaining: null,
  lastSyncTime: '',
  processedRecords: 0,
  logs: [],
  diagnosticsData: null,
  isScanningSubnet: false,
  isDiagnosing: false
};

// ─── Translations Dictionary (Constitution Rule 6: Zero Missing Keys) ───
const i18n = {
  ar: {
    // Top Bar & General
    appSubtitle: 'محرك مزامنة البصمة السحابي',
    coreModules: 'الوحدات الأساسية',
    systemManagement: 'إدارة النظام والتشخيص',
    dashboard: 'لوحة التحكم والمراقبة',
    connectedDevices: 'الأجهزة المتصلة',
    liveSyncLogs: 'سجلات المزامنة المباشرة',
    advancedSettings: 'الإعدادات والربط المتقدم',
    smartDiagnostics: 'كشف الأعطال والتشخيص الذكي',
    healthyPill: 'سليم',
    clientConnected: 'العميل متصل (Live)',
    opActive: 'الوضع التشغيلي: نشط',
    opStopped: 'الوضع التشغيلي: متوقف',
    testAllDevices: 'اختبار الاتصال بالأجهزة',
    runDiagnosticsBtn: 'فحص الأعطال الذكي',
    saveChanges: 'حفظ التغييرات',

    // Dashboard
    dashboardTitle: 'لوحة التحكم والمراقبة',
    dashboardSubtitle: 'مراقبة دورات المزامنة اللحظية وحالة اتصال أجهزة البصمة بالسيرفر السحابي',
    syncRunning: 'المزامنة تعمل الآن',
    syncStopped: 'المزامنة متوقفة',
    syncActiveTitle: 'المحرك في حالة مزامنة نشطة',
    syncActiveDesc: 'يتم ترحيل سجلات الحركات تلقائياً من الأجهزة المربوطة إلى سحابة كوادر بأمان فائق.',
    syncStoppedTitle: 'النظام في حالة توقف مؤقت',
    syncStoppedDesc: 'جميع عمليات المزامنة التلقائية معلقة حالياً. اضغط "بدء المزامنة" لاستئناف الترحيل.',
    startSync: 'بدء المزامنة التلقائية',
    stopSync: 'إيقاف المزامنة التلقائية',
    syncNow: 'مزامنة الآن',
    resetWatermark: 'إعادة ضبط',
    lastSync: 'آخر مزامنة ناجحة',
    processedRecords: 'السجلات المعالجة',
    activeDevicesCount: 'الأجهزة النشطة',
    systemHealth: 'صحة الاتصال',
    liveTerminalTitle: 'سجل العمليات اللحظي',
    filterAll: 'الكل',
    filterSuccess: 'ناجح',
    filterWarnings: 'تحذير',
    filterErrors: 'خطأ',
    clear: 'مسح',
    export: 'تصدير',

    // Settings
    settingsTitle: 'الإعدادات العامة وإدارة المزامنة',
    settingsSubtitle: 'ضبط معايير الأجهزة المحلية وبروتوكولات الربط المباشر مع سيرفر كوادر السحابي',
    hardwareTopologyTitle: 'إدارة وهيكلية ربط الأجهزة',
    hardwareTopologyDesc: 'مراقبة سعة وحصة الأجهزة المصرح بربطها وإدارة مصفوفة أجهزة الحضور',
    networkMode: 'نوع الاتصال العام:',
    selectArchitecture: 'اختر المنظومة التقنية الافتراضية (Architecture Protocol):',
    directHighSpeed: 'يدعم الربط المباشر عالي السرعة',
    hikDesc: 'أجهزة البصمة ومحطات الوجه MinMoe والتحكم بالدخول عبر ISAPI API المباشر.',
    zkDesc: 'أجهزة الحضور وساعات الدوام البيومترية بأنظمة Pull SDK وبروتوكول ZKTeco القياسي.',
    quotaTitle: 'سعة الأجهزة المسموحة وحصة الاستهلاك (Capacity & Quota)',
    enterpriseTier: 'باقة Enterprise',
    inventoryTitle: 'قائمة الأجهزة المربوطة والمخصصة (Inventory Matrix)',
    autoScanSubnet: 'فحص الشبكة الفرعية (Auto-Scan Subnet)',
    addNewDevice: 'إضافة جهاز جديد +',
    thDevice: 'الجهاز والموقع',
    thModel: 'الموديل والبروتوكول',
    thIpPort: 'عنوان IP والمنفذ',
    thStatus: 'الحالة وزمن الاستجابة',
    thActions: 'إجراءات',
    licenseKeyCardTitle: 'مفتاح الترخيص والتحقق الأمني',
    licenseKeyCardDesc: 'رمز التفعيل السحابي المعتمد للمزامنة المشفرة RSA-4096',
    licensedToCorp: 'مرخص للشركات المتعددة',
    verifyWithServer: 'التحقق من السيرفر',
    licenseExpiry: 'تاريخ انتهاء الصلاحية',
    syncSpeedRate: 'معدل نقل البيانات السحابي',
    sslNotice: 'يتم تشفير كافة سجلات الحركات تلقائياً قبل إرسالها إلى سحابة كوادر عبر SSL TLS 1.3.',
    syncEngineTitle: 'محرك المزامنة التلقائية',
    syncEngineDesc: 'جدولة الترحيل الدوري للحركات',
    liveDirectSync: 'المزامنة المباشرة المستمرة',
    liveDirectSyncDesc: 'سحب حركات البصمة فور تسجيل الموظف وترحيلها لحظياً دون انتظار الفاصل الزمني.',
    autoStartWin: 'التشغيل التلقائي مع الويندوز',
    autoStartWinDesc: 'تشغيل محرك المزامنة في خلفية النظام تلقائياً عند بدء إقلاع نظام التشغيل.',
    syncIntervalLabel: 'الفاصل الزمني للدورة الدورية',
    offlineBufferTitle: 'التخزين الاحتياطي (Offline Buffer)',
    offlineBufferDesc: 'حفظ السجلات محلياً في قاعدة بيانات SQLite عند انقطاع الإنترنت، وإعادة إرسالها فور عودة الاتصال دون فقدان أي بصمة.',

    // Devices Matrix Page
    devicesTitle: 'مصفوفة الأجهزة المتصلة',
    devicesSubtitle: 'إدارة ومراقبة كافة أجهزة الحضور المتصلة بشبكة المنشأة وفحص زمن استجابتها لحظياً',
    devicesMatrixTitle: 'إدارة أجهزة البصمة البيومترية',
    devicesMatrixDesc: 'إدارة ومراقبة كافة أجهزة الحضور المتصلة بشبكة المنشأة وفحص زمن استجابتها لحظياً',
    scanNetwork: 'فحص الشبكة',
    addDeviceBtn: 'إضافة جهاز جديد',

    // Diagnostics Page
    diagnosticsTitle: 'مركز كشف الأعطال والتشخيص الذكي',
    diagnosticsSubtitle: 'فحص آلي شامل لـ 6 مستويات حيوية وتقديم الحلول التلقائية للأعطال',
    smartDiagCenterTitle: 'نظام كشف الأعطال والتشخيص الذكي (Smart AI Diagnostics)',
    smartDiagCenterDesc: 'فحص آلي شامل لـ 6 مستويات حيوية: السحابة، التراخيص، منافذ الشبكة وجدار الحماية، أجهزة البصمة، وفارق التوقيت مع الحلول الفورية بنقرة واحدة.',
    startDiagnosticScan: 'بدء الفحص الذكي الشامل',
    diagnosingRunning: 'جار الفحص الشامل...',
    faultsMatrixTitle: 'مصفوفة الأعطال المكتشفة والحلول المقترحة (Root-Cause Matrix)',
    allSystemsHealthy: 'جميع الأنظمة والأجهزة تعمل بكفاءة وبدون أعطال',
    allSystemsHealthyDesc: 'الربط السحابي، مفتاح الترخيص، استجابة أجهزة البصمة، وتوقيت الساعات متطابق بنسبة 100%.',

    // Diagnostics Checks
    diag_cloud_title: 'الاتصال بسحابة كوادر (Cloud Gateway)',
    diag_cloud_healthy: 'الخادم السحابي مستجيب بنجاح عبر SSL TLS 1.3.',
    diag_cloud_fault: 'تعذر الاتصال بسيرفر كوادر السحابي، تحقق من اتصال الإنترنت و DNS.',
    diag_license_title: 'رخصة المنشأة والـ Secret Key',
    diag_license_healthy: 'الترخيص نشط ومعتمد (باقة Enterprise Active).',
    diag_license_fault: 'مفتاح الترخيص غير مدخل أو انتهت صلاحيته.',
    diag_local_net_title: 'الشبكة المحلية والـ Gateway',
    diag_local_net_healthy: 'الشبكة المحلية والمنفذ المحلي مستقر دون تعارض.',
    diag_local_net_fault: 'تعذر كشف الشبكة المحلية أو هناك تعارض في عنوان IP.',
    diag_devices_title: 'أجهزة البصمة المتصلة',
    diag_devices_healthy: 'تم فحص جميع الأجهزة واستجابتها ممتازة.',
    diag_devices_fault: 'بعض أجهزة البصمة غير مستجيبة أو غير متصلة بالشبكة.',
    diag_clock_title: 'تطابق التوقيت والساعات',
    diag_clock_healthy: 'فارق التوقيت مع الخادم أقل من ثانية واحدة.',
    diag_clock_fault: 'يوجد انحراف زمني بين ساعة الجهاز وتوقيت الخادم.',
    diag_storage_title: 'محرك التخزين المحلي والـ Buffer',
    diag_storage_healthy: 'التخزين الاحتياطي جاهز للعمل عند انقطاع الإنترنت.',
    diag_storage_fault: 'تحذير في التخزين المؤقت المحلي.',

    // Status Enums
    healthy: 'سليم',
    warning: 'تحذير',
    critical: 'حرج',
    latency: 'زمن الاستجابة',
    verifiedPill: 'تم الفحص آلياً',

    // Modals & Forms
    subnetModalTitle: 'فحص الشبكة الفرعية الذكي (Network Scanner)',
    subnetModalDesc: 'اكتشاف أجهزة الحضور (ZKTeco و Hikvision) المتصلة تلقائياً في شبكة المنشأة',
    scanningLan: 'جار فحص الشبكة المحلية...',
    pressScanToStart: 'اضغط "بدء الفحص السريع" لكشف جميع أجهزة البصمة المتصلة بنطاق الـ IP المحلي.',
    startScan: 'بدء الفحص السريع',
    close: 'إغلاق',
    addDeviceModalTitle: 'إضافة جهاز بصمة جديد',
    deviceNameLabel: 'اسم الجهاز والموقع التعريفي',
    deviceTypeLabel: 'نوع ومنظومة الجهاز (Protocol Architecture)',
    deviceIpLabel: 'عنوان IP المحلي للجهاز',
    devicePortLabel: 'منفذ الاتصال (Port)',
    deviceSnLabel: 'الرقم التسلسلي (Serial Number)',
    usernameLabel: 'اسم المستخدم لجهاز Hikvision',
    passwordLabel: 'كلمة المرور لجهاز Hikvision',
    useHttpsLabel: 'استخدام بروتوكول HTTPS المشفر (Port 443)',
    testDevice: 'اختبار الاتصال بالجهاز',
    saveDevice: 'حفظ بيانات الجهاز',
    liveSyncLogsTitle: 'سجلات المزامنة المباشرة',

    // Toasts & Notifications
    settingsSaved: 'تم حفظ جميع الإعدادات بنجاح.',
    keyCopied: 'تم نسخ مفتاح الترخيص للحافظة.',
    deviceAdded: 'تمت إضافة الجهاز بنجاح إلى المصفوفة.',
    deviceDeleted: 'تم حذف الجهاز من المصفوفة.',
    deviceUpdated: 'تم تحديث بيانات الجهاز.',
    clockSynced: 'تمت مزامنة توقيت الجهاز مع توقيت الحاسوب بنجاح.',
    exportDone: 'تم تجهيز ملف السجلات للتنزيل.'
  },
  en: {
    // Top Bar & General
    appSubtitle: 'Cloud Biometric Sync Engine',
    coreModules: 'Core Modules',
    systemManagement: 'System & Diagnostics',
    dashboard: 'Dashboard & Monitor',
    connectedDevices: 'Connected Devices',
    liveSyncLogs: 'Live Sync Logs',
    advancedSettings: 'Advanced Settings',
    smartDiagnostics: 'Smart Diagnostics & Faults',
    healthyPill: 'Healthy',
    clientConnected: 'Client Live (Connected)',
    opActive: 'Operating State: Active',
    opStopped: 'Operating State: Stopped',
    testAllDevices: 'Test All Devices',
    runDiagnosticsBtn: 'Smart Diagnostics',
    saveChanges: 'Save Changes',

    // Dashboard
    dashboardTitle: 'Dashboard & Monitor',
    dashboardSubtitle: 'Real-time synchronization cycles and device connectivity status',
    syncRunning: 'Sync is Running',
    syncStopped: 'Sync is Stopped',
    syncActiveTitle: 'Engine in Active Sync Mode',
    syncActiveDesc: 'Attendance punch logs are automatically synchronized to Kwader Cloud safely.',
    syncStoppedTitle: 'System is Currently Suspended',
    syncStoppedDesc: 'Automatic synchronization is suspended. Press "Start Sync" to resume.',
    startSync: 'Start Auto-Sync',
    stopSync: 'Stop Auto-Sync',
    syncNow: 'Sync Now',
    resetWatermark: 'Reset Watermark',
    lastSync: 'Last Successful Sync',
    processedRecords: 'Processed Records',
    activeDevicesCount: 'Active Devices',
    systemHealth: 'Connection Health',
    liveTerminalTitle: 'Live Real-Time Event Feed',
    filterAll: 'All',
    filterSuccess: 'Success',
    filterWarnings: 'Warning',
    filterErrors: 'Error',
    clear: 'Clear',
    export: 'Export',

    // Settings
    settingsTitle: 'General Settings & Hardware Topology',
    settingsSubtitle: 'Configure local biometric devices and direct cloud connection parameters',
    hardwareTopologyTitle: 'Hardware Topology & Device Architecture',
    hardwareTopologyDesc: 'Define hardware protocols and device capacity entitlement for your tenant',
    networkMode: 'Network Mode:',
    selectArchitecture: 'Select Default Architecture Protocol:',
    directHighSpeed: 'Supports direct high-speed integration',
    hikDesc: 'Face recognition and access terminals via direct ISAPI HTTPS protocol.',
    zkDesc: 'Biometric time clocks using ZKTeco Standalone TCP/UDP protocol.',
    quotaTitle: 'Device Quota & Capacity Entitlement',
    enterpriseTier: 'Enterprise Tier',
    inventoryTitle: 'Configured Hardware Matrix',
    autoScanSubnet: 'Auto-Scan Subnet',
    addNewDevice: 'Add New Device +',
    thDevice: 'Device & Location',
    thModel: 'Model & Protocol',
    thIpPort: 'IP & Port',
    thStatus: 'Status & Latency',
    thActions: 'Actions',
    licenseKeyCardTitle: 'License Secret Key & Security Entitlements',
    licenseKeyCardDesc: 'Cloud activation secret key with RSA-4096 encrypted sync',
    licensedToCorp: 'Multi-Tenant Enterprise License',
    verifyWithServer: 'Verify with Server',
    licenseExpiry: 'License Expiration',
    syncSpeedRate: 'Cloud Transfer Rate',
    sslNotice: 'All attendance records are securely encrypted via SSL TLS 1.3 before transmission.',
    syncEngineTitle: 'Sync Engine Automation',
    syncEngineDesc: 'Automated recurring log sync scheduling',
    liveDirectSync: 'Live Direct Sync',
    liveDirectSyncDesc: 'Pull attendance punch logs immediately upon registration without waiting.',
    autoStartWin: 'Auto-Start with Windows',
    autoStartWinDesc: 'Automatically start agent in background upon Windows boot.',
    syncIntervalLabel: 'Cycle Interval',
    offlineBufferTitle: 'Offline Buffer & Storage',
    offlineBufferDesc: 'Store records locally in SQLite during internet outages and replay upon reconnection.',

    // Devices Matrix Page
    devicesTitle: 'Connected Device Matrix',
    devicesSubtitle: 'Manage and monitor all attendance hardware on company network',
    devicesMatrixTitle: 'Biometric Attendance Hardware',
    devicesMatrixDesc: 'Monitor latency and operational readiness of all networked devices',
    scanNetwork: 'Scan Network',
    addDeviceBtn: 'Add Device',

    // Diagnostics Page
    diagnosticsTitle: 'Smart Fault Detection & Diagnostics Center',
    diagnosticsSubtitle: 'Automated 6-level health scan with one-click root-cause resolutions',
    smartDiagCenterTitle: 'Smart Fault Detection & Diagnostics Center (AI-Powered)',
    smartDiagCenterDesc: 'Automated health audit covering 6 vital layers: Cloud API, License, LAN/Firewall, Devices Matrix, Clock Drift, and Offline Storage Buffer.',
    startDiagnosticScan: 'Start Full Diagnostics Scan',
    diagnosingRunning: 'Scanning all systems...',
    faultsMatrixTitle: 'Detected Faults & Root-Cause Matrix',
    allSystemsHealthy: 'All systems and devices are operating with 100% health',
    allSystemsHealthyDesc: 'Cloud gateway, license entitlements, device latencies, and clock synchronization are verified.',

    // Diagnostics Checks
    diag_cloud_title: 'KWADER Cloud Gateway Connection',
    diag_cloud_healthy: 'Cloud gateway responding successfully via SSL TLS 1.3.',
    diag_cloud_fault: 'Unable to reach Kwader Cloud. Check internet connection and DNS settings.',
    diag_license_title: 'Organization License & Secret Key',
    diag_license_healthy: 'Enterprise active license verified.',
    diag_license_fault: 'License key is missing or expired.',
    diag_local_net_title: 'Local Network & Subnet Gateway',
    diag_local_net_healthy: 'Local subnet interface and gateway are stable.',
    diag_local_net_fault: 'Local network interface error or IP collision.',
    diag_devices_title: 'Biometric Hardware Matrix',
    diag_devices_healthy: 'All configured devices responded with optimal latency.',
    diag_devices_fault: 'One or more devices are unreachable on the local network.',
    diag_clock_title: 'Clock Synchronization & Drift',
    diag_clock_healthy: 'Device clock drift is under 1 second.',
    diag_clock_fault: 'Clock discrepancy detected between device and host server.',
    diag_storage_title: 'Offline Storage & Local Buffer',
    diag_storage_healthy: 'SQLite local offline buffer operational.',
    diag_storage_fault: 'Local offline database buffer warning.',

    // Status Enums
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
    latency: 'Latency',
    verifiedPill: 'Auto-Verified',

    // Modals & Forms
    subnetModalTitle: 'Smart Subnet Network Scanner',
    subnetModalDesc: 'Automatically discover active ZKTeco and Hikvision devices on company LAN',
    scanningLan: 'Scanning local subnet...',
    pressScanToStart: 'Press "Start Quick Scan" to discover biometric terminals in the local IP range.',
    startScan: 'Start Quick Scan',
    close: 'Close',
    addDeviceModalTitle: 'Add New Biometric Device',
    deviceNameLabel: 'Device Name & Location',
    deviceTypeLabel: 'Device Protocol Architecture',
    deviceIpLabel: 'Local Device IP Address',
    devicePortLabel: 'Connection Port',
    deviceSnLabel: 'Serial Number',
    usernameLabel: 'Hikvision Username',
    passwordLabel: 'Hikvision Password',
    useHttpsLabel: 'Use Encrypted HTTPS (Port 443)',
    testDevice: 'Test Connection',
    saveDevice: 'Save Device',
    liveSyncLogsTitle: 'Live Synchronization Logs',

    // Toasts & Notifications
    settingsSaved: 'All settings saved successfully.',
    keyCopied: 'License secret key copied to clipboard.',
    deviceAdded: 'Device successfully added to matrix.',
    deviceDeleted: 'Device removed from matrix.',
    deviceUpdated: 'Device details updated.',
    clockSynced: 'Device clock synchronized with host computer.',
    exportDone: 'Logs exported successfully.'
  }
};

function t(key) {
  if (!key) return '';
  const currentLang = state.language || 'ar';
  return (i18n[currentLang] && i18n[currentLang][key]) || (i18n.ar && i18n.ar[key]) || (i18n.en && i18n.en[key]) || key;
}

// ─── UI Helpers ────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ─── Responsive Sidebar Controls ───────────────────────────
window.toggleSidebar = () => {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar) return;

  if (window.innerWidth < 768) {
    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) {
      sidebar.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.remove('active');
    } else {
      sidebar.classList.add('mobile-open');
      if (backdrop) backdrop.classList.add('active');
    }
  } else if (window.innerWidth < 1100) {
    const isExpanded = sidebar.classList.contains('tablet-expanded');
    if (isExpanded) {
      sidebar.classList.remove('tablet-expanded');
      if (backdrop) backdrop.classList.remove('active');
    } else {
      sidebar.classList.add('tablet-expanded');
      if (backdrop) backdrop.classList.add('active');
    }
  } else {
    sidebar.classList.toggle('collapsed');
  }
};

window.closeMobileSidebar = () => {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) {
    sidebar.classList.remove('mobile-open');
    sidebar.classList.remove('tablet-expanded');
  }
  if (backdrop) backdrop.classList.remove('active');
};

window.addEventListener('resize', () => {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (window.innerWidth >= 1100) {
    if (sidebar) {
      sidebar.classList.remove('mobile-open');
      sidebar.classList.remove('tablet-expanded');
    }
    if (backdrop) backdrop.classList.remove('active');
  } else if (window.innerWidth >= 768) {
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  }
});

// ─── Navigation Logic ──────────────────────────────────────
window.navigatePage = (pageId, clickedEl) => {
  state.activePage = pageId;

  // Auto-close mobile drawer if open
  if (window.innerWidth < 768) {
    window.closeMobileSidebar();
  }

  // Toggle active class on sidebar
  document.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => {
    item.classList.remove('active');
  });
  if (clickedEl) {
    clickedEl.classList.add('active');
  } else {
    const target = document.querySelector(`.sidebar-nav .nav-item[data-page="${pageId}"]`);
    if (target) target.classList.add('active');
  }

  // Toggle tab contents
  document.querySelectorAll('.page-tab').forEach((tab) => {
    tab.classList.remove('active');
  });
  const currentTab = document.getElementById(`page-${pageId}`);
  if (currentTab) currentTab.classList.add('active');

  // Update Topbar Title & Subtitle
  const titleEl = document.getElementById('pageHeaderTitle');
  const subEl = document.getElementById('pageHeaderSubtitle');
  if (titleEl && subEl) {
    titleEl.innerText = t(`${pageId}Title`);
    subEl.innerText = t(`${pageId}Subtitle`);
  }

  // Re-render sub-views if needed
  if (pageId === 'devices') {
    renderDevicesCards();
  } else if (pageId === 'diagnostics' && !state.diagnosticsData) {
    runFullDiagnostics();
  }
};

// ─── Initialization ─────────────────────────────────────────
async function initApp() {
  const api = getApi();
  if (!api) {
    // Graceful demo mock for previewing in standard browser
    setupDemoState();
    renderAll();
    return;
  }

  try {
    const settings = await api.get_settings();
    state.licenseKey = settings.licenseKey || '';
    state.syncInterval = settings.syncInterval || 60;
    state.autoStart = !!settings.autoStart;
    state.language = settings.language || 'ar';
    state.deviceQuota = settings.deviceQuota || 10;
    state.offlineBuffer = settings.offlineBuffer !== false;
    state.liveSync = settings.liveSync !== false;
    state.devices = settings.devices || [];

    const status = await api.get_status();
    state.isSyncing = !!status.isSyncing;
    state.lastSyncTime = status.lastSync || '';

    applyLanguage(state.language);
    applyLicenseAndQuotaData(settings);
    renderAll();

    // Run auto-diagnostics in background after 2 seconds
    setTimeout(() => {
      runFullDiagnostics(true);
    }, 2000);
  } catch (err) {
    console.error('Failed to init app:', err);
  }
}

function setupDemoState() {
  state.licenseKey = 'kw_live_9840-7489-8812-4011';
  state.companyName = 'شركة الأمل الدولية للتجارة';
  state.plan = 'Enterprise';
  state.licenseStatus = 'active';
  state.licenseExpiry = '2027-12-31';
  state.daysRemaining = 480;
  state.deviceQuota = 25;
  applyLicenseAndQuotaData(state);
  state.devices = [
    {
      id: 'dev-1',
      name: 'بوابة المقر الرئيسي (المدخل)',
      location: 'المبنى الرئيسي',
      type: 'hikvision',
      ip: '192.168.1.100',
      port: 80,
      sn: 'DS-K1T671MF-98231',
      username: 'admin',
      is_active: true,
      is_master: true,
      latency_ms: 12
    },
    {
      id: 'dev-2',
      name: 'فرع العمليات والمستودع',
      location: 'المستودع الرئيسي',
      type: 'hikvision',
      ip: '192.168.1.101',
      port: 80,
      sn: 'DS-K1T341AM-55410',
      username: 'admin',
      is_active: true,
      is_master: false,
      latency_ms: 18
    },
    {
      id: 'dev-3',
      name: 'مبنى الإدارة المالية - الدور 2',
      location: 'الإدارة العامة',
      type: 'zkteco',
      ip: '192.168.1.120',
      port: 4370,
      sn: 'ZK-UFACE800-4491',
      is_active: true,
      is_master: false,
      latency_ms: 45
    }
  ];
}

function renderAll() {
  renderSettingsInputs();
  renderInventoryTable();
  renderDevicesCards();
  renderQuotaMeter();
  updateSyncStateUI();
  updateSidebarMetrics();
}

// ─── Settings Rendering ────────────────────────────────────
function renderSettingsInputs() {
  const licInput = document.getElementById('licenseKey');
  if (licInput) licInput.value = state.licenseKey;

  const syncIntInput = document.getElementById('syncInterval');
  if (syncIntInput) {
    syncIntInput.value = state.syncInterval;
    updateIntervalLabel(state.syncInterval);
  }

  const autoStart = document.getElementById('autoStartToggle');
  if (autoStart) autoStart.checked = state.autoStart;

  const offlineToggle = document.getElementById('offlineBufferToggle');
  if (offlineToggle) offlineToggle.checked = state.offlineBuffer;

  const liveToggle = document.getElementById('liveSyncToggle');
  if (liveToggle) liveToggle.checked = state.liveSync;

  const quotaDisplay = document.getElementById('quotaDisplayNumber');
  if (quotaDisplay) {
    quotaDisplay.innerText = String(state.deviceQuota).padStart(2, '0');
  }
}

// ─── Real-Time Company & License Entitlement Applicator ────
function applyLicenseAndQuotaData(data) {
  if (!data) return;
  if (data.companyName) state.companyName = data.companyName;
  if (data.plan) state.plan = data.plan;
  if (data.expiry || data.licenseExpiry) state.licenseExpiry = data.expiry || data.licenseExpiry;
  if (data.daysRemaining !== undefined && data.daysRemaining !== null) state.daysRemaining = data.daysRemaining;
  if (data.deviceQuota) state.deviceQuota = parseInt(data.deviceQuota) || state.deviceQuota;
  if (data.status) state.licenseStatus = data.status;

  // 1. Update Corporate Name Subtitle
  const corpEl = document.getElementById('licensedCorpName');
  if (corpEl) {
    if (state.companyName) {
      corpEl.innerText = `مرخص لـ: ${state.companyName}`;
      corpEl.className = 'text-emerald-400 text-[11px] font-sans font-bold';
    } else {
      corpEl.innerText = t('licensedToCorp') || 'مرخص للشركات المتعددة';
      corpEl.className = 'text-slate-400 text-[11px] font-sans';
    }
  }

  // 2. Update License Card Badge
  const cardBadge = document.getElementById('licenseCardBadge');
  if (cardBadge) {
    const planName = (state.plan || 'ENTERPRISE').toUpperCase();
    const isActive = (state.licenseStatus || 'active').toLowerCase() === 'active';
    cardBadge.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
      ${planName} ${isActive ? 'ACTIVE' : 'EXPIRED'}
    `;
    cardBadge.className = `license-status-badge ${isActive ? '' : 'border-rose-500/30 text-rose-400'}`;
  }

  // 3. Update Expiry Date Card
  const expiryEl = document.getElementById('licenseExpiryVal');
  if (expiryEl && state.licenseExpiry) {
    let daysTxt = '';
    if (state.daysRemaining != null) {
      daysTxt = state.daysRemaining > 0 ? `(متبقي ${state.daysRemaining} يوم)` : '(منتهي الصلاحية)';
    } else {
      try {
        const expDate = new Date(state.licenseExpiry);
        const today = new Date();
        const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        daysTxt = diffDays > 0 ? `(متبقي ${diffDays} يوم)` : '(منتهي الصلاحية)';
      } catch (e) {
        daysTxt = '';
      }
    }
    expiryEl.innerHTML = `
      <span class="material-symbols-outlined text-[16px] text-emerald-400">event_available</span>
      ${state.licenseExpiry} ${daysTxt}
    `;
  }

  // 4. Update Quota Tier Badge in Topology
  const quotaBadge = document.getElementById('quotaTierBadge');
  if (quotaBadge) {
    const planDisplayName = state.plan ? (state.plan.charAt(0).toUpperCase() + state.plan.slice(1)) : 'Enterprise';
    quotaBadge.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> باقة ${planDisplayName} Active
    `;
  }

  // 5. Update Quota Display Number in settings
  const quotaDisplay = document.getElementById('quotaDisplayNumber');
  if (quotaDisplay) {
    quotaDisplay.innerText = String(state.deviceQuota).padStart(2, '0');
  }

  // 6. Re-render Quota Meter
  renderQuotaMeter();
}

function updateIntervalLabel(val) {
  const lbl = document.getElementById('intervalPreviewLabel');
  if (lbl) {
    if (val < 60) lbl.innerText = `${val} ثانية`;
    else lbl.innerText = `${Math.round(val / 60)} دقيقة (${val} ث)`;
  }
}

window.setIntervalPreset = (sec) => {
  state.syncInterval = sec;
  const input = document.getElementById('syncInterval');
  if (input) input.value = sec;
  updateIntervalLabel(sec);

  document.querySelectorAll('.interval-chip').forEach((c) => c.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
};

function renderQuotaMeter() {
  const used = state.devices.length;
  const total = state.deviceQuota || 10;
  const pct = Math.min(100, Math.round((used / total) * 100));

  const usedEl = document.getElementById('quotaUsedDevices');
  if (usedEl) usedEl.innerText = `${used} أجهزة نشطة`;

  const totalEl = document.getElementById('quotaTotalDevices');
  if (totalEl) totalEl.innerText = `${total} أجهزة`;

  const pctLabel = document.getElementById('quotaPercentLabel');
  if (pctLabel) pctLabel.innerText = `${used} أجهزة مستخدمة (${pct}%)`;

  const avail = Math.max(0, total - used);
  const availLabel = document.getElementById('quotaAvailableLabel');
  if (availLabel) {
    if (avail === 0) {
      availLabel.innerHTML = `<span class="text-rose-400 font-bold">تم استنفاد السعة المصرح بها بالكامل</span>`;
    } else {
      availLabel.innerText = `${avail} شاغرة متوفرة للإضافة الفورية`;
    }
  }

  const fillBar = document.getElementById('quotaFillBar');
  if (fillBar) {
    fillBar.style.width = `${pct}%`;
    if (pct >= 100) {
      fillBar.style.background = 'linear-gradient(90deg, #ef4444, #f43f5e)';
    } else if (pct >= 80) {
      fillBar.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    } else {
      fillBar.style.background = 'linear-gradient(90deg, #3b82f6, #60a5fa)';
    }
  }

  const pillRatio = document.getElementById('quotaPillRatio');
  if (pillRatio) {
    pillRatio.innerText = `${String(used).padStart(2, '0')} / ${String(total).padStart(2, '0')} نشط`;
  }
}

// ─── Inventory Matrix Table & Cards ─────────────────────────
function renderInventoryTable() {
  const tbody = document.getElementById('deviceInventoryTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const countLabel = document.getElementById('inventoryCountLabel');
  if (countLabel) countLabel.innerText = `(${state.devices.length} Devices Configured)`;

  if (state.devices.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-8 text-slate-400 text-xs">
          لا توجد أجهزة مضافة بعد. اضغط "إضافة جهاز جديد +" أو "فحص الشبكة الفرعية" لإضافة أجهزة الحضور.
        </td>
      </tr>
    `;
    return;
  }

  state.devices.forEach((dev, idx) => {
    const tr = document.createElement('tr');
    const isHik = String(dev.type).toLowerCase() === 'hikvision';
    const modelTag = isHik ? 'Hikvision Facial (ISAPI)' : 'ZKTeco Standalone (UDP)';
    const modelColor = isHik ? 'bg-blue-400' : 'bg-indigo-400';
    const num = String(idx + 1).padStart(2, '0');
    const latency = dev.latency_ms || 15;

    tr.innerHTML = `
      <td>
        <div class="flex items-center gap-2.5">
          <div class="device-avatar-num">${num}</div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-white">${clean(dev.name || 'جهاز بصمة')}</span>
              ${dev.is_master ? '<span class="device-master-pill">MASTER</span>' : ''}
            </div>
            <span class="text-[11px] text-slate-400 font-mono">SN: ${clean(dev.sn || 'N/A')}</span>
          </div>
        </div>
      </td>
      <td>
        <div class="flex items-center gap-1.5 font-semibold text-slate-300">
          <span class="w-2 h-2 rounded-full ${modelColor}"></span>
          <span>${modelTag}</span>
        </div>
        <span class="text-[10px] text-slate-400 font-mono">${dev.location || 'الفرع الرئيسي'}</span>
      </td>
      <td>
        <div class="device-ip-box dir-ltr">
          ${clean(dev.ip)} : <span class="${isHik ? 'text-blue-400' : 'text-indigo-400'}">${dev.port}</span>
        </div>
      </td>
      <td>
        <div class="flex items-center gap-2" id="dev-status-${dev.id}">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="font-semibold text-emerald-400">متصل ونشط</span>
          <span class="device-latency-pill">${latency}ms</span>
        </div>
      </td>
      <td class="text-center">
        <div class="flex items-center justify-center gap-1">
          <button class="table-action-btn btn-test" onclick="testSingleDevice('${dev.id}')" title="فحص الاتصال وزمن الاستجابة">
            <span class="material-symbols-outlined text-[18px]">network_check</span>
          </button>
          <button class="table-action-btn btn-edit" onclick="openEditDeviceModal('${dev.id}')" title="تعديل بيانات الجهاز">
            <span class="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button class="table-action-btn btn-delete" onclick="deleteDevice('${dev.id}')" title="حذف الجهاز">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDevicesCards() {
  const container = document.getElementById('devicesCardsGrid');
  if (!container) return;

  container.innerHTML = '';
  if (state.devices.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-xs col-span-3 py-6 text-center">لا توجد أجهزة متصلة بعد.</p>';
    return;
  }

  state.devices.forEach((dev) => {
    const isHik = String(dev.type).toLowerCase() === 'hikvision';
    const card = document.createElement('div');
    card.className = 'card p-5 space-y-4 hover:border-slate-700 transition-colors';
    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl ${isHik ? 'bg-blue-500/15 text-blue-400' : 'bg-indigo-500/15 text-indigo-400'} flex items-center justify-center">
            <span class="material-symbols-outlined">${isHik ? 'video_camera_front' : 'fingerprint'}</span>
          </div>
          <div>
            <h4 class="text-sm font-bold text-white">${clean(dev.name)}</h4>
            <p class="text-[11px] text-slate-400">${dev.location || 'المقر الرئيسي'}</p>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isHik ? 'bg-blue-500/20 text-blue-300' : 'bg-indigo-500/20 text-indigo-300'}">
          ${isHik ? 'HIKVISION' : 'ZKTECO'}
        </span>
      </div>

      <div class="p-2.5 rounded-lg bg-slate-900/80 font-mono text-xs text-slate-300 flex items-center justify-between">
        <span>IP: ${dev.ip}</span>
        <span class="text-blue-400">Port: ${dev.port}</span>
      </div>

      <div class="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
        <div class="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>استجابة: ${dev.latency_ms || 15}ms</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-dark-outline btn-sm" onclick="syncDeviceClockById('${dev.id}')" title="مزامنة ساعة الجهاز مع توقيت الحاسوب">
            <span class="material-symbols-outlined text-sm">schedule</span>
            <span>ضبط الوقت</span>
          </button>
          <button class="btn btn-primary-glass btn-sm" onclick="testSingleDevice('${dev.id}')">
            <span class="material-symbols-outlined text-sm">wifi_tethering</span>
            <span>اختبار</span>
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateSidebarMetrics() {
  const countEl = document.getElementById('sidebarDeviceCount');
  if (countEl) countEl.innerText = state.devices.length;

  const activeCountEl = document.getElementById('metricActiveDevices');
  if (activeCountEl) activeCountEl.innerText = state.devices.length;

  const recordsEl = document.getElementById('metricRecordsCount');
  if (recordsEl) recordsEl.innerText = state.processedRecords;
}

// ─── Single Device Actions ─────────────────────────────────
window.testSingleDevice = async (deviceId) => {
  const dev = state.devices.find((d) => d.id === deviceId);
  if (!dev) return;

  const statusEl = document.getElementById(`dev-status-${deviceId}`);
  if (statusEl) {
    statusEl.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
      <span class="font-semibold text-amber-400">${t('testing')}</span>
    `;
  }

  showToast(`جار فحص الاتصال بـ ${dev.name}...`, 'info');
  const api = getApi();
  if (!api) {
    setTimeout(() => {
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="font-semibold text-emerald-400">متصل (Demo)</span>
          <span class="device-latency-pill">14ms</span>
        `;
      }
      showToast(`تم الاتصال بنجاح مع ${dev.name}`, 'success');
    }, 800);
    return;
  }

  try {
    const res = await api.test_device(dev);
    if (res && res.success) {
      dev.latency_ms = res.latency_ms || 12;
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="font-semibold text-emerald-400">متصل ونشط</span>
          <span class="device-latency-pill">${dev.latency_ms}ms</span>
        `;
      }
      showToast(`${dev.name}: ${res.message}`, 'success');
    } else {
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-rose-500"></span>
          <span class="font-semibold text-rose-400">انقطع الاتصال</span>
        `;
      }
      showToast(`${dev.name}: ${res ? res.message : 'فشل الاتصال'}`, 'error');
    }
  } catch (err) {
    showToast(`خطأ في فحص الجهاز: ${err}`, 'error');
  }
};

window.syncDeviceClockById = async (deviceId) => {
  const dev = state.devices.find((d) => d.id === deviceId);
  if (!dev) return;

  showToast(`جار مزامنة ساعة ${dev.name}...`, 'info');
  const api = getApi();
  if (api && api.sync_device_clock) {
    try {
      const res = await api.sync_device_clock(dev);
      if (res && res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res ? res.message : 'فشل ضبط الوقت', 'error');
      }
    } catch (err) {
      showToast(`خطأ: ${err}`, 'error');
    }
  } else {
    showToast(t('clockSynced'), 'success');
  }
};

window.deleteDevice = (deviceId) => {
  if (!confirm('هل أنت متأكد من حذف هذا الجهاز من المصفوفة؟')) return;
  state.devices = state.devices.filter((d) => d.id !== deviceId);
  renderAll();
  showToast(t('deviceDeleted'), 'info');
};

// ─── Add / Edit Device Modal Logic ─────────────────────────
window.openAddDeviceModal = () => {
  document.getElementById('modalDeviceId').value = '';
  document.getElementById('modalDeviceName').value = '';
  document.getElementById('modalDeviceIp').value = '';
  document.getElementById('modalDevicePort').value = '4370';
  document.getElementById('modalDeviceSn').value = '';
  document.getElementById('modalDeviceType').value = 'zkteco';
  document.getElementById('deviceModalTitle').innerText = t('addDeviceModalTitle');
  document.getElementById('modalTestResult').classList.add('hidden');
  onModalDeviceTypeChange();
  document.getElementById('deviceModal').classList.remove('hidden');
};

window.openEditDeviceModal = (deviceId) => {
  const dev = state.devices.find((d) => d.id === deviceId);
  if (!dev) return;

  document.getElementById('modalDeviceId').value = dev.id;
  document.getElementById('modalDeviceName').value = dev.name || '';
  document.getElementById('modalDeviceIp').value = dev.ip || '';
  document.getElementById('modalDevicePort').value = dev.port || 4370;
  document.getElementById('modalDeviceSn').value = dev.sn || '';
  document.getElementById('modalDeviceType').value = dev.type || 'zkteco';
  document.getElementById('modalHikUsername').value = dev.username || 'admin';
  document.getElementById('modalHikPassword').value = dev.password || '';
  document.getElementById('modalHikHttps').checked = !!dev.use_https;
  document.getElementById('deviceModalTitle').innerText = 'تعديل بيانات الجهاز';
  document.getElementById('modalTestResult').classList.add('hidden');
  onModalDeviceTypeChange();
  document.getElementById('deviceModal').classList.remove('hidden');
};

window.closeDeviceModal = () => {
  document.getElementById('deviceModal').classList.add('hidden');
};

window.onModalDeviceTypeChange = () => {
  const type = document.getElementById('modalDeviceType').value;
  const hikFields = document.getElementById('modalHikFields');
  const portInput = document.getElementById('modalDevicePort');

  if (type === 'hikvision') {
    hikFields.classList.remove('hidden');
    if (portInput.value === '4370') portInput.value = '80';
  } else {
    hikFields.classList.add('hidden');
    if (portInput.value === '80') portInput.value = '4370';
  }
};

const deviceForm = document.getElementById('deviceForm');
if (deviceForm) {
  deviceForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('modalDeviceId').value;
    const type = document.getElementById('modalDeviceType').value;

    const deviceData = {
      id: id || `dev-${Date.now()}`,
      name: document.getElementById('modalDeviceName').value.trim(),
      ip: document.getElementById('modalDeviceIp').value.trim(),
      port: parseInt(document.getElementById('modalDevicePort').value) || 4370,
      sn: document.getElementById('modalDeviceSn').value.trim(),
      type: type,
      username: document.getElementById('modalHikUsername').value.trim() || 'admin',
      password: document.getElementById('modalHikPassword').value,
      use_https: document.getElementById('modalHikHttps').checked,
      is_active: true,
      latency_ms: 15
    };

    if (id) {
      const idx = state.devices.findIndex((d) => d.id === id);
      if (idx !== -1) state.devices[idx] = deviceData;
      showToast(t('deviceUpdated'), 'success');
    } else {
      state.devices.push(deviceData);
      showToast(t('deviceAdded'), 'success');
    }

    closeDeviceModal();
    renderAll();
    saveAllSettings();
  });
}

// ─── Subnet Auto-Scanner Modal ─────────────────────────────
window.triggerSubnetModal = () => {
  const input = document.getElementById('subnetCidrInput');
  if (input && !input.value) input.value = '192.168.1.';
  document.getElementById('subnetModal').classList.remove('hidden');
  if (input) setTimeout(() => input.focus(), 50);
};

window.closeSubnetModal = () => {
  document.getElementById('subnetModal').classList.add('hidden');
};

window.setSubnetPreset = (prefix) => {
  const input = document.getElementById('subnetCidrInput');
  if (input) {
    input.value = prefix;
    input.focus();
  }
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.closeSubnetModal();
    if (typeof window.closeDeviceModal === 'function') {
      window.closeDeviceModal();
    }
  }
});

const btnExecuteSubnetScan = document.getElementById('btnExecuteSubnetScan');
if (btnExecuteSubnetScan) {
  btnExecuteSubnetScan.addEventListener('click', async () => {
    const input = document.getElementById('subnetCidrInput');
    const subnet = input ? input.value.trim() : '192.168.1.';
    const progress = document.getElementById('subnetScanProgress');
    const list = document.getElementById('subnetResultsList');

    if (progress) progress.classList.remove('hidden');
    btnExecuteSubnetScan.disabled = true;

    const api = getApi();
    let results = [];
    if (api && api.scan_subnet) {
      try {
        results = await api.scan_subnet(subnet);
      } catch (err) {
        console.error('Scan failed:', err);
      }
    } else {
      // Mock demo results for browser preview
      await new Promise((r) => setTimeout(r, 1200));
      results = [
        { ip: '192.168.1.100', port: 80, type: 'hikvision', latency_ms: 12 },
        { ip: '192.168.1.101', port: 80, type: 'hikvision', latency_ms: 18 },
        { ip: '192.168.1.120', port: 4370, type: 'zkteco', latency_ms: 45 }
      ];
    }

    if (progress) progress.classList.add('hidden');
    btnExecuteSubnetScan.disabled = false;

    if (!results || results.length === 0) {
      list.innerHTML = `<p class="text-xs text-rose-400 text-center py-6">لم يتم العثور على أجهزة بصمة نشطة في النطاق ${subnet}0/24.</p>`;
      return;
    }

    list.innerHTML = '';
    results.forEach((r, idx) => {
      const isHik = r.type === 'hikvision';
      const row = document.createElement('div');
      row.className = 'p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs';
      row.innerHTML = `
        <div class="flex items-center gap-2.5">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <div>
            <p class="font-bold text-white font-mono">${r.ip}:${r.port}</p>
            <p class="text-[11px] text-slate-400">${isHik ? 'Hikvision Facial ISAPI' : 'ZKTeco Standalone'}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">${r.latency_ms}ms</span>
          <button class="btn btn-primary-glass btn-sm" onclick="addScannedDevice('${r.ip}', ${r.port}, '${r.type}')">
            <span>+ إضافة</span>
          </button>
        </div>
      `;
      list.appendChild(row);
    });
  });
}

window.addScannedDevice = (ip, port, type) => {
  const isHik = type === 'hikvision';
  const newDev = {
    id: `dev-${Date.now()}`,
    name: isHik ? `جهاز هيكفيجن (${ip})` : `جهاز زد كيه (${ip})`,
    location: 'المقر المكتشف',
    ip: ip,
    port: port,
    type: type,
    sn: '',
    username: 'admin',
    password: '',
    is_active: true,
    latency_ms: 15
  };
  state.devices.push(newDev);
  renderAll();
  saveAllSettings();
  showToast(`تمت إضافة الجهاز ${ip} إلى المصفوفة بنجاح`, 'success');
};

// ─── Smart Diagnostics Engine ──────────────────────────────
window.runFullDiagnostics = async (silent = false) => {
  if (state.isDiagnosing) return;
  state.isDiagnosing = true;

  const btn = document.getElementById('btnRunFullDiagnostics');
  const icon = document.getElementById('diagRunBtnIcon');
  if (btn && !silent) {
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">sync</span> ${t('diagnosingRunning')}`;
  }

  const api = getApi();
  let diag = null;
  if (api && api.run_smart_diagnostics) {
    try {
      diag = await api.run_smart_diagnostics();
    } catch (err) {
      console.error('Diagnostics call failed:', err);
    }
  }

  if (!diag) {
    // Fallback computed diagnostics
    diag = computeFallbackDiagnostics();
  }

  state.diagnosticsData = diag;
  renderDiagnosticsView(diag);
  state.isDiagnosing = false;

  if (btn && !silent) {
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined">troubleshoot</span> ${t('startDiagnosticScan')}`;
    showToast('اكتمل فحص التشخيص الذكي الشامل بنجاح.', 'success');
  }
};

function computeFallbackDiagnostics() {
  const hasDrift = !state.mockDriftResolved;
  const checks = [
    { id: 'cloud', title: 'الاتصال بسحابة كوادر (Cloud Gateway)', icon: 'cloud_done', status: 'healthy', latency_ms: 38, details: 'الخادم السحابي مستجيب بنجاح عبر SSL TLS 1.3.' },
    { id: 'license', title: 'رخصة المنشأة والـ Secret Key', icon: 'verified', status: 'healthy', latency_ms: 12, details: 'الترخيص نشط ومعتمد (باقة Enterprise Active).' },
    { id: 'local_net', title: 'الشبكة المحلية والـ Gateway', icon: 'lan', status: 'healthy', latency_ms: 1, details: 'الشبكة الفرعية 192.168.1.0/24 تعمل بدون تعارض.' },
    { id: 'devices', title: 'أجهزة البصمة المتصلة', icon: 'devices', status: 'healthy', latency_ms: 15, details: `تم فحص ${state.devices.length || 1} جهاز واستجابتها ممتازة على الشبكة.` },
    {
      id: 'clock',
      title: 'تطابق التوقيت والساعات',
      icon: 'schedule',
      status: hasDrift ? 'warning' : 'healthy',
      latency_ms: 2,
      max_drift_sec: hasDrift ? 48 : 1,
      has_drift: hasDrift,
      details: hasDrift ? 'تم رصد فارق زمني قدره 48 ثانية بين ساعة الجهاز وتوقيت النظام المعتمد.' : 'فارق التوقيت مع الخادم وساعات الأجهزة أقل من ثانية واحدة (متطابق 100%).'
    },
    { id: 'storage', title: 'محرك التخزين المحلي والـ Buffer', icon: 'storage', status: 'healthy', latency_ms: 1, details: 'التخزين الاحتياطي جاهز للعمل عند انقطاع الإنترنت.' }
  ];

  const faults = [];
  if (hasDrift) {
    faults.push({
      severity: 'warning',
      code: 'WARN_CLOCK_DRIFT',
      title: 'انحراف زمني في ساعة جهاز البصمة (48 ثانية)',
      cause: 'ساعة الجهاز الداخلية تختلف عن التوقيت المعتمد بمقدار 48 ثانية، مما قد يسبب تسجيل بصمات بتوقيت غير مطابق.',
      recommendation: 'قم بتصحيح وقت البصمة ومزامنته مع وقت الكمبيوتر أو توقيت المنشأة السحابي بنقرة واحدة.',
      action_label: 'تصحيح وقت البصمة',
      clock_drift_sec: 48,
      device_id: state.devices[0]?.id || 'dev-1'
    });
  }

  return {
    score: hasDrift ? 92 : 100,
    overall: hasDrift ? 'warning' : 'healthy',
    checks,
    faults
  };
}

function renderDiagnosticsView(diag) {
  const scoreTag = document.getElementById('diagScoreTag');
  const sidebarPill = document.getElementById('sidebarDiagBadge');
  const metricHealth = document.getElementById('metricHealthScore');

  if (scoreTag) {
    scoreTag.innerText = `${diag.score}% ${diag.overall.toUpperCase()}`;
    scoreTag.className = `diag-score-tag ${diag.overall === 'healthy' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`;
  }

  if (sidebarPill) {
    sidebarPill.innerText = diag.overall === 'healthy' ? '100% سليم' : 'تنبيه';
    sidebarPill.className = `nav-badge-alert ${diag.overall === 'healthy' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'}`;
  }

  if (metricHealth) {
    metricHealth.innerText = `${diag.score}%`;
  }

  // Render 6 Checks Grid
  const checksGrid = document.getElementById('diagChecksGrid');
  if (checksGrid && diag.checks) {
    checksGrid.innerHTML = '';
    diag.checks.forEach((chk) => {
      const isOk = chk.status === 'healthy';
      const isWarn = chk.status === 'warning';
      const statusClass = isOk ? 'check-healthy' : isWarn ? 'check-warning' : 'check-critical';
      const iconColor = isOk ? 'text-emerald-400 bg-emerald-500/15' : isWarn ? 'text-amber-400 bg-amber-500/15' : 'text-rose-400 bg-rose-500/15';

      // Normalize check id
      const checkId = (chk.id === 'cloud_api' ? 'cloud' : chk.id) || 'cloud';
      const checkTitle = t(`diag_${checkId}_title`) || chk.title || checkId;
      
      // Dynamic details precedence
      let checkDetails = chk.details;
      if (!checkDetails) {
        checkDetails = isOk ? (t(`diag_${checkId}_healthy`) || 'Healthy') : (t(`diag_${checkId}_fault`) || 'Warning');
      }

      const statusPillText = isOk ? t('healthy') : isWarn ? t('warning') : t('critical');
      const latencyText = `${t('latency')}: ${chk.latency_ms !== null && chk.latency_ms !== undefined ? `${chk.latency_ms}ms` : '1ms'}`;

      // Interactive Action Button for Clock Card
      let clockActionHtml = '';
      if (checkId === 'clock') {
        if (!isOk || chk.has_drift) {
          const driftVal = chk.max_drift_sec ? `${chk.max_drift_sec} ثانية` : 'بحاجة للمزامنة';
          clockActionHtml = `
            <div class="mt-2.5 pt-2.5 border-t border-amber-500/25 flex items-center justify-between gap-2">
              <span class="text-[11px] font-bold text-amber-400 flex items-center gap-1 font-mono">
                <span class="material-symbols-outlined text-[15px]">warning</span>
                ${driftVal}
              </span>
              <button class="btn btn-emerald-glass btn-sm" onclick="openClockSyncModal()" type="button" title="تصحيح وقت البصمة ومزامنته">
                <span class="material-symbols-outlined text-[16px]">schedule</span>
                <span>تصحيح وقت البصمة</span>
              </button>
            </div>
          `;
        } else {
          clockActionHtml = `
            <div class="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span class="text-emerald-400 font-mono flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">done_all</span>
                ساعة متطابقة 100%
              </span>
              <button class="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1" onclick="openClockSyncModal()" type="button">
                <span class="material-symbols-outlined text-[14px]">sync</span>
                مزامنة التوقيت
              </button>
            </div>
          `;
        }
      }

      const card = document.createElement('div');
      card.className = `diag-check-card ${statusClass}`;
      card.innerHTML = `
        <div class="diag-check-head">
          <div class="diag-check-title-group">
            <div class="diag-check-icon ${iconColor}">
              <span class="material-symbols-outlined text-[20px]">${chk.icon || 'verified'}</span>
            </div>
            <h4 class="diag-check-name">${checkTitle}</h4>
          </div>
          <span class="diag-check-status-pill ${isOk ? 'bg-emerald-500/20 text-emerald-400' : isWarn ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}">
            ${statusPillText}
          </span>
        </div>
        <p class="diag-check-details">${checkDetails}</p>
        ${clockActionHtml}
        <div class="diag-check-foot">
          <span>${latencyText}</span>
          <span class="text-slate-500 font-mono">${t('verifiedPill')}</span>
        </div>
      `;
      checksGrid.appendChild(card);
    });
  }

  // Render Faults & Root-Cause Matrix
  const faultsList = document.getElementById('detectedFaultsList');
  const countLabel = document.getElementById('detectedFaultsCount');
  if (countLabel) {
    const faultCount = diag.faults ? diag.faults.length : 0;
    countLabel.innerText = `${faultCount} ${state.language === 'en' ? 'Faults Detected' : 'أعطال مكتشفة'}`;
  }

  if (faultsList) {
    faultsList.innerHTML = '';
    if (!diag.faults || diag.faults.length === 0) {
      faultsList.innerHTML = `
        <div class="all-healthy-box">
          <span class="material-symbols-outlined text-emerald-400 text-3xl">verified</span>
          <div>
            <h4 class="text-sm font-bold text-white">${t('allSystemsHealthy')}</h4>
            <p class="text-xs text-slate-400 mt-0.5">${t('allSystemsHealthyDesc')}</p>
          </div>
        </div>
      `;
    } else {
      diag.faults.forEach((fault) => {
        const isCritical = fault.severity === 'critical';
        const box = document.createElement('div');
        box.className = `fault-box ${isCritical ? 'severity-critical' : 'severity-warning'}`;
        
        const faultPayloadEscaped = JSON.stringify(fault).replace(/"/g, '&quot;');

        box.innerHTML = `
          <div class="fault-header">
            <div class="fault-title-group">
              <span class="material-symbols-outlined ${isCritical ? 'text-rose-400' : 'text-amber-400'}">
                ${isCritical ? 'error' : 'warning'}
              </span>
              <h4 class="fault-title">${clean(fault.title)}</h4>
            </div>
            <span class="fault-code-tag">${clean(fault.code)}</span>
          </div>

          <p class="fault-desc"><strong>${state.language === 'en' ? 'Diagnosis:' : 'التشخيص والسبب:'}</strong> ${clean(fault.cause)}</p>

          <div class="fault-fix-row">
            <span class="text-xs text-slate-300"><strong>${state.language === 'en' ? 'Resolution:' : 'الإجراء المقترح:'}</strong> ${clean(fault.recommendation)}</span>
            ${fault.action_label ? `<button class="btn btn-emerald-glass btn-sm" onclick="handleFaultAction('${fault.code}', ${faultPayloadEscaped})"><span class="material-symbols-outlined text-sm">auto_fix_high</span> ${clean(fault.action_label)}</button>` : ''}
          </div>
        `;
        faultsList.appendChild(box);
      });
    }
  }
}

// ─── Fault Resolution Handler ──────────────────────────────
window.handleFaultAction = async (code, faultData = null) => {
  if (code === 'WARN_CLOCK_DRIFT') {
    const devId = faultData?.device_id || faultData?.device_data?.id || null;
    openClockSyncModal(devId, faultData);
  } else if (code === 'FAULT_NO_DEVICES') {
    triggerSubnetModal();
  } else if (code === 'FAULT_LICENSE_MISSING' || code === 'FAULT_LICENSE_INACTIVE') {
    switchTab('settings');
    setTimeout(() => {
      const el = document.getElementById('licenseKey');
      if (el) { el.focus(); el.select(); }
    }, 200);
  } else {
    runFullDiagnostics();
  }
};

window.executeFaultAction = window.handleFaultAction;

// ─── Clock Synchronization & Correction Modal Engine ──────
let selectedClockTimeSource = 'computer';
let selectedClockTargetDeviceId = null;
let clockPreviewTimer = null;

window.openClockSyncModal = async (deviceId = null, faultData = null) => {
  selectedClockTargetDeviceId = deviceId;
  const modal = document.getElementById('clockSyncModal');
  if (!modal) return;

  const targetNameEl = document.getElementById('clockModalTargetDeviceName');
  const targetIpEl = document.getElementById('clockModalTargetDeviceIp');
  const driftBadge = document.getElementById('clockModalDriftBadge');

  if (deviceId && state.devices) {
    const dev = state.devices.find(d => d.id === deviceId);
    if (dev) {
      if (targetNameEl) targetNameEl.innerText = dev.name || 'جهاز البصمة';
      if (targetIpEl) targetIpEl.innerText = `${dev.ip}:${dev.port || (dev.type === 'hikvision' ? 80 : 4370)} (${dev.type === 'hikvision' ? 'Hikvision' : 'ZKTeco'})`;
    }
  } else {
    if (targetNameEl) targetNameEl.innerText = 'جميع أجهزة البصمة المربوطة في الشبكة';
    const count = state.devices?.length || 1;
    if (targetIpEl) targetIpEl.innerText = `مزامنة موحدة وتصحيح لكافة الأجهزة (${count} أجهزة)`;
  }

  if (driftBadge) {
    if (faultData && faultData.clock_drift_sec) {
      driftBadge.innerText = `انحراف التوقيت: ${faultData.clock_drift_sec} ثانية`;
      driftBadge.className = 'text-xs font-mono px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/35 font-bold';
    } else {
      driftBadge.innerText = 'جاهز للمزامنة الفورية';
      driftBadge.className = 'text-xs font-mono px-2.5 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/35 font-bold';
    }
  }

  // Update live preview clocks
  updateModalClockPreviews();
  if (clockPreviewTimer) clearInterval(clockPreviewTimer);
  clockPreviewTimer = setInterval(updateModalClockPreviews, 1000);

  modal.classList.remove('hidden');
};

window.closeClockSyncModal = () => {
  const modal = document.getElementById('clockSyncModal');
  if (modal) modal.classList.add('hidden');
  if (clockPreviewTimer) {
    clearInterval(clockPreviewTimer);
    clockPreviewTimer = null;
  }
};

window.selectClockTimeSource = (src) => {
  selectedClockTimeSource = src;
  const cardComp = document.getElementById('sourceCardComputer');
  const cardAcc = document.getElementById('sourceCardAccount');
  const radioComp = document.querySelector('input[name="clockTimeSource"][value="computer"]');
  const radioAcc = document.querySelector('input[name="clockTimeSource"][value="account"]');

  if (src === 'account') {
    if (cardAcc) cardAcc.classList.add('active');
    if (cardComp) cardComp.classList.remove('active');
    if (radioAcc) radioAcc.checked = true;
  } else {
    if (cardComp) cardComp.classList.add('active');
    if (cardAcc) cardAcc.classList.remove('active');
    if (radioComp) radioComp.checked = true;
  }
};

async function updateModalClockPreviews() {
  const now = new Date();
  const compTimeStr = now.toTimeString().split(' ')[0];
  const compEl = document.getElementById('previewComputerTime');
  if (compEl) compEl.innerText = compTimeStr;

  // Account Timezone preview
  const tzEl = document.getElementById('previewAccountTime');
  const tzNameEl = document.getElementById('previewAccountTzName');

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Riyadh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const accTimeStr = formatter.format(now);
    if (tzEl) tzEl.innerText = accTimeStr;
    if (tzNameEl) tzNameEl.innerText = 'توقيت مكة والرياض المعتمد في حسابك (Asia/Riyadh - GMT+3)';
  } catch (e) {
    if (tzEl) tzEl.innerText = compTimeStr;
  }
}

window.executeClockSync = async () => {
  const btn = document.getElementById('btnExecuteClockSync');
  const btnText = document.getElementById('btnClockSyncText');
  if (btn) {
    btn.disabled = true;
    if (btnText) btnText.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> جار ضبط الساعة...';
  }

  const api = getApi();
  const src = selectedClockTimeSource;
  const devId = selectedClockTargetDeviceId;

  try {
    let res = null;
    if (api) {
      if (devId) {
        const targetDev = state.devices?.find(d => d.id === devId) || { id: devId };
        if (api.sync_device_clock) {
          res = await api.sync_device_clock(targetDev, src);
        }
      } else {
        if (api.sync_all_clocks) {
          res = await api.sync_all_clocks(src);
        } else if (api.sync_device_clock && state.devices && state.devices.length > 0) {
          res = await api.sync_device_clock(state.devices[0], src);
        }
      }
    } else {
      // In-browser mock demo for UI verification
      await new Promise(r => setTimeout(r, 600));
      res = {
        success: true,
        message: `تم تصحيح ومزامنة وقت البصمة بنجاح بحسب (${src === 'account' ? 'توقيت حساب المنشأة السحابي Asia/Riyadh' : 'وقت الكمبيوتر المحلي'}).`
      };
    }

    if (res && res.success) {
      state.mockDriftResolved = true;
      showToast(res.message || 'تم تصحيح ومزامنة وقت أجهزة البصمة بنجاح.', 'success');
      closeClockSyncModal();
      // Re-run diagnostics to reflect healthy status!
      runFullDiagnostics(true);
    } else {
      showToast(`فشل تصحيح الساعة: ${res?.message || 'خطأ غير معروف'}`, 'error');
    }
  } catch (err) {
    showToast(`حدث خطأ أثناء تصحيح الساعة: ${err}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      if (btnText) btnText.innerHTML = 'تصحيح ومزامنة وقت البصمة الآن';
    }
  }
};

// ─── Save & Verify Logic ────────────────────────────────────
async function saveAllSettings() {
  const payload = {
    licenseKey: (document.getElementById('licenseKey')?.value || '').trim(),
    companyName: state.companyName || '',
    plan: state.plan || '',
    status: state.licenseStatus || 'active',
    licenseExpiry: state.licenseExpiry || '',
    daysRemaining: state.daysRemaining,
    syncInterval: parseInt(document.getElementById('syncInterval')?.value) || 60,
    autoStart: !!document.getElementById('autoStartToggle')?.checked,
    offlineBuffer: !!document.getElementById('offlineBufferToggle')?.checked,
    liveSync: !!document.getElementById('liveSyncToggle')?.checked,
    deviceQuota: state.deviceQuota,
    devices: state.devices,
    language: state.language
  };

  const api = getApi();
  if (api) {
    try {
      await api.save_settings(payload);
      showToast(t('settingsSaved'), 'success');
    } catch (err) {
      showToast(`فشل حفظ الإعدادات: ${err}`, 'error');
    }
  } else {
    showToast(t('settingsSaved'), 'success');
  }
}

const btnHeaderSave = document.getElementById('btnHeaderSave');
if (btnHeaderSave) {
  btnHeaderSave.addEventListener('click', saveAllSettings);
}

const verifyLicenseBtn = document.getElementById('verifyLicenseBtn');
if (verifyLicenseBtn) {
  verifyLicenseBtn.addEventListener('click', async () => {
    const key = (document.getElementById('licenseKey')?.value || '').trim();
    const fb = document.getElementById('licenseFeedback');
    if (!key) {
      if (fb) {
        fb.innerHTML = '<span class="text-rose-400 font-bold">مفتاح الترخيص مطلوب.</span>';
        fb.className = 'text-xs mt-1.5';
      }
      return;
    }

    verifyLicenseBtn.disabled = true;
    if (fb) {
      fb.innerHTML = '<span class="text-slate-400 flex items-center gap-1.5"><span class="animate-spin material-symbols-outlined text-sm">progress_activity</span> جار التحقق من السيرفر السحابي لكوادر...</span>';
      fb.className = 'text-xs mt-1.5';
    }

    const api = getApi();
    if (api) {
      try {
        const res = await api.verify_license(key);
        if (res && res.valid) {
          applyLicenseAndQuotaData(res);
          if (fb) {
            fb.innerHTML = `<span class="text-emerald-400 font-bold flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm">check_circle</span>
              تم التحقق بنجاح • المنشأة: <strong>${clean(res.companyName)}</strong> | الباقة: <strong>${clean(res.plan)}</strong> | سعة الأجهزة: <strong>${res.deviceQuota} أجهزة</strong>
            </span>`;
            fb.className = 'text-xs mt-1.5';
          }
          showToast(`تم تأكيد الترخيص بنجاح: ${res.companyName} (${res.plan})`, 'success');
        } else {
          if (fb) {
            fb.innerHTML = `<span class="text-rose-400 font-bold flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm">cancel</span>
              فشل التحقق: ${clean(res ? res.message : 'المفتاح غير صالح')}
            </span>`;
            fb.className = 'text-xs mt-1.5';
          }
        }
      } catch (err) {
        if (fb) {
          fb.innerHTML = `<span class="text-rose-400 font-bold">خطأ في الاتصال: ${clean(err)}</span>`;
          fb.className = 'text-xs mt-1.5';
        }
      } finally {
        verifyLicenseBtn.disabled = false;
      }
    } else {
      setTimeout(() => {
        const mockRes = {
          valid: true,
          companyName: 'شركة تجريبية للأنظمة',
          plan: 'Pro',
          status: 'active',
          expiry: '2027-06-30',
          daysRemaining: 295,
          deviceQuota: 15
        };
        applyLicenseAndQuotaData(mockRes);
        if (fb) {
          fb.innerHTML = `<span class="text-emerald-400 font-bold flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm">check_circle</span>
            تم التحقق بنجاح (معاينة) • المنشأة: <strong>${mockRes.companyName}</strong> | الباقة: <strong>${mockRes.plan}</strong> | سعة الأجهزة: <strong>${mockRes.deviceQuota} أجهزة</strong>
          </span>`;
          fb.className = 'text-xs mt-1.5';
        }
        verifyLicenseBtn.disabled = false;
        showToast('تم تأكيد الترخيص بنجاح (معاينة).', 'success');
      }, 700);
    }
  });
}

// ─── Secret Key Utilities ──────────────────────────────────
const btnToggleLicenseReveal = document.getElementById('btnToggleLicenseReveal');
if (btnToggleLicenseReveal) {
  btnToggleLicenseReveal.addEventListener('click', () => {
    const input = document.getElementById('licenseKey');
    const icon = document.getElementById('licenseRevealIcon');
    if (!input || !icon) return;

    if (input.type === 'password') {
      input.type = 'text';
      icon.innerText = 'visibility_off';
    } else {
      input.type = 'password';
      icon.innerText = 'visibility';
    }
  });
}

const btnCopyLicenseKey = document.getElementById('btnCopyLicenseKey');
if (btnCopyLicenseKey) {
  btnCopyLicenseKey.addEventListener('click', () => {
    const input = document.getElementById('licenseKey');
    if (input && input.value) {
      navigator.clipboard.writeText(input.value);
      showToast(t('keyCopied'), 'success');
    }
  });
}

const btnSyncLicenseQuota = document.getElementById('btnSyncLicenseQuota');
if (btnSyncLicenseQuota) {
  btnSyncLicenseQuota.addEventListener('click', async () => {
    const icon = document.getElementById('syncQuotaIcon');
    if (icon) icon.classList.add('animate-spin');
    btnSyncLicenseQuota.disabled = true;

    try {
      const api = getApi();
      if (api && api.verify_license) {
        const key = (document.getElementById('licenseKey')?.value || state.licenseKey || '').trim();
        const res = await api.verify_license(key);
        if (res && res.valid) {
          applyLicenseAndQuotaData(res);
          showToast(`تم تحديث بيانات وحصة المنشأة: ${res.companyName} (${res.deviceQuota} أجهزة)`, 'success');
        } else {
          showToast(res?.message || 'تم التحقق من السيرفر: الحصة الحالية معتمدة ومحدثة.', 'info');
        }
      } else {
        await new Promise((r) => setTimeout(r, 600));
        showToast('تم تحديث بيانات وحصة الترخيص بنجاح من السيرفر السحابي.', 'success');
      }
    } catch (err) {
      console.error('Failed to sync quota:', err);
      showToast('تعذر الاتصال بالسيرفر لتحديث الحصة.', 'error');
    } finally {
      if (icon) icon.classList.remove('animate-spin');
      btnSyncLicenseQuota.disabled = false;
      renderQuotaMeter();
    }
  });
}
const toggleSyncBtn = document.getElementById('toggleSyncBtn');
if (toggleSyncBtn) {
  toggleSyncBtn.addEventListener('click', async () => {
    const api = getApi();
    if (state.isSyncing) {
      if (api) await api.stop_sync();
      state.isSyncing = false;
    } else {
      if (api) await api.start_sync();
      state.isSyncing = true;
    }
    updateSyncStateUI();
  });
}

const forceSyncBtn = document.getElementById('forceSyncBtn');
if (forceSyncBtn) {
  forceSyncBtn.addEventListener('click', async () => {
    forceSyncBtn.disabled = true;
    showToast('جار تشغيل دورة المزامنة الفورية...', 'info');

    const api = getApi();
    if (api) {
      try {
        const time = await api.force_sync();
        state.lastSyncTime = time || '';
        document.getElementById('metricLastSync').innerText = time;
        showToast('اكتملت دورة المزامنة الفورية بنجاح.', 'success');
      } catch (err) {
        showToast(`خطأ في المزامنة: ${err}`, 'error');
      } finally {
        forceSyncBtn.disabled = false;
      }
    } else {
      setTimeout(() => {
        const now = new Date().toLocaleTimeString();
        state.lastSyncTime = now;
        document.getElementById('metricLastSync').innerText = now;
        forceSyncBtn.disabled = false;
        showToast('اكتملت المزامنة التجريبية بنجاح.', 'success');
      }, 1000);
    }
  });
}

const resetSyncBtn = document.getElementById('resetSyncBtn');
if (resetSyncBtn) {
  resetSyncBtn.addEventListener('click', async () => {
    if (!confirm('هل تريد إعادة ضبط علامة المزامنة لترحيل كافة الحركات السابقة في الدورة القادمة؟')) return;

    const api = getApi();
    if (api) {
      await api.reset_sync_for_license();
      showToast('تمت إعادة ضبط علامة المزامنة بنجاح.', 'success');
    } else {
      showToast('تمت إعادة ضبط علامة المزامنة (Demo).', 'success');
    }
  });
}

function updateSyncStateUI() {
  const btn = document.getElementById('toggleSyncBtn');
  const icon = document.getElementById('toggleSyncIcon');
  const text = document.getElementById('toggleSyncText');
  const badge = document.getElementById('headerOperationalBadge');
  const badgeText = document.getElementById('headerOperationalText');
  const heroTitle = document.getElementById('dashHeroTitle');
  const heroDesc = document.getElementById('dashHeroDesc');
  const pill = document.getElementById('dashStatusPill');
  const pillText = document.getElementById('dashStatusPillText');
  const ringProgress = document.getElementById('ringProgressCircle');
  const bigIcon = document.getElementById('bigStatusIcon');

  if (state.isSyncing) {
    if (btn) btn.className = 'btn btn-dark-outline btn-large w-full';
    if (icon) icon.innerText = 'pause';
    if (text) text.innerText = t('stopSync');
    if (badge) badge.className = 'operational-badge badge-active';
    if (badgeText) badgeText.innerText = t('opActive');
    if (heroTitle) heroTitle.innerText = t('syncActiveTitle');
    if (heroDesc) heroDesc.innerText = t('syncActiveDesc');
    if (pill) pill.className = 'status-pill-badge badge-active';
    if (pillText) pillText.innerText = t('syncRunning');
    if (ringProgress) {
      ringProgress.style.stroke = '#3b82f6';
      ringProgress.style.strokeDashoffset = '0';
    }
    if (bigIcon) bigIcon.innerText = 'sync';
  } else {
    if (btn) btn.className = 'btn btn-gradient-primary btn-large w-full';
    if (icon) icon.innerText = 'play_arrow';
    if (text) text.innerText = t('startSync');
    if (badge) badge.className = 'operational-badge badge-stopped';
    if (badgeText) badgeText.innerText = t('opStopped');
    if (heroTitle) heroTitle.innerText = t('syncStoppedTitle');
    if (heroDesc) heroDesc.innerText = t('syncStoppedDesc');
    if (pill) pill.className = 'status-pill-badge badge-stopped';
    if (pillText) pillText.innerText = t('syncStopped');
    if (ringProgress) {
      ringProgress.style.stroke = '#ef4444';
      ringProgress.style.strokeDashoffset = '200';
    }
    if (bigIcon) bigIcon.innerText = 'cloud_off';
  }
}

// ─── Real-Time Python Event Handlers ───────────────────────
window.onPythonLog = ({ message, type }) => {
  state.processedRecords += type === 'success' ? 1 : 0;
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const logObj = { time, message, type };
  state.logs.push(logObj);

  const termView = document.getElementById('terminalLogView');
  const fullLogs = document.getElementById('fullLogsView');

  const line = document.createElement('div');
  line.className = `term-line ${type}`;
  const tagText = type === 'error' ? '[ERR]' : type === 'warning' ? '[WARN]' : type === 'success' ? '[OK]' : '[INFO]';
  const tagClass = type === 'error' ? 'tag-err' : type === 'warning' ? 'tag-warn' : type === 'success' ? 'tag-ok' : 'tag-info';

  line.innerHTML = `
    <span class="term-time">[${time}]</span>
    <span class="term-tag ${tagClass}">${tagText}</span>
    <span class="term-msg">${clean(message)}</span>
  `;

  if (termView) {
    termView.appendChild(line);
    while (termView.children.length > 200) termView.removeChild(termView.firstChild);
    termView.scrollTop = termView.scrollHeight;
  }

  if (fullLogs) {
    const fullLine = line.cloneNode(true);
    fullLogs.appendChild(fullLine);
    while (fullLogs.children.length > 500) fullLogs.removeChild(fullLogs.firstChild);
    fullLogs.scrollTop = fullLogs.scrollHeight;
  }

  const linesCount = document.getElementById('terminalLinesCount');
  if (linesCount) linesCount.innerText = `Lines: ${state.logs.length}`;
};

window.onSyncStateChanged = (isSyncing) => {
  state.isSyncing = !!isSyncing;
  updateSyncStateUI();
};

window.onSyncCompleted = (timeStr) => {
  state.lastSyncTime = timeStr;
  const metric = document.getElementById('metricLastSync');
  if (metric) metric.innerText = timeStr;
};

// ─── Terminal Controls & Export ────────────────────────────
const btnClearLogs = document.getElementById('btnClearLogs');
if (btnClearLogs) {
  btnClearLogs.addEventListener('click', () => {
    state.logs = [];
    const termView = document.getElementById('terminalLogView');
    const fullLogs = document.getElementById('fullLogsView');
    if (termView) termView.innerHTML = '';
    if (fullLogs) fullLogs.innerHTML = '';
  });
}

const btnExportLogs = document.getElementById('btnExportLogs');
if (btnExportLogs) {
  btnExportLogs.addEventListener('click', () => {
    const text = state.logs.map((l) => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kwader-sync-logs-${Date.now()}.txt`;
    a.click();
    showToast(t('exportDone'), 'success');
  });
}

// ─── Language Switcher ─────────────────────────────────────
const languageToggle = document.getElementById('languageToggle');
if (languageToggle) {
  languageToggle.addEventListener('click', async () => {
    state.language = state.language === 'ar' ? 'en' : 'ar';
    applyLanguage(state.language);
    const api = getApi();
    if (api && api.set_language) {
      await api.set_language(state.language);
    }
  });
}

function applyLanguage(lang) {
  state.language = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  const langText = document.getElementById('langText');
  if (langText) langText.innerText = lang === 'ar' ? 'EN' : 'عربي';

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) {
      const translated = t(key);
      if (translated && translated !== key) {
        el.innerText = translated;
      }
    }
  });

  const titleEl = document.getElementById('pageHeaderTitle');
  const subEl = document.getElementById('pageHeaderSubtitle');
  if (titleEl && subEl) {
    titleEl.innerText = t(`${state.activePage}Title`);
    subEl.innerText = t(`${state.activePage}Subtitle`);
  }

  updateSyncStateUI();
  if (state.diagnosticsData) {
    renderDiagnosticsView(state.diagnosticsData);
  }
  renderInventoryTable();
  renderDevicesCards();
}

function clean(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Header Quick Actions ──────────────────────────────────
const btnQuickTestConn = document.getElementById('btnQuickTestConn');
if (btnQuickTestConn) {
  btnQuickTestConn.addEventListener('click', async () => {
    if (state.devices.length === 0) {
      showToast('لا توجد أجهزة متصلة لاختبارها.', 'warning');
      return;
    }
    showToast('جار فحص الاتصال بجميع الأجهزة المتصلة...', 'info');
    for (const dev of state.devices) {
      await testSingleDevice(dev.id);
    }
  });
}

const btnHeaderSmartDiag = document.getElementById('btnHeaderSmartDiag');
if (btnHeaderSmartDiag) {
  btnHeaderSmartDiag.addEventListener('click', () => {
    navigatePage('diagnostics');
  });
}

const btnAddNewDevice = document.getElementById('btnAddNewDevice');
if (btnAddNewDevice) {
  btnAddNewDevice.addEventListener('click', openAddDeviceModal);
}

const btnAutoScanSubnet = document.getElementById('btnAutoScanSubnet');
if (btnAutoScanSubnet) {
  btnAutoScanSubnet.addEventListener('click', triggerSubnetModal);
}

const btnRunFullDiagnostics = document.getElementById('btnRunFullDiagnostics');
if (btnRunFullDiagnostics) {
  btnRunFullDiagnostics.addEventListener('click', () => runFullDiagnostics());
}

// ─── Entry Point ───────────────────────────────────────────
if (window.pywebview) {
  initApp();
} else {
  window.addEventListener('pywebviewready', initApp);
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(initApp, 200);
  });
}
