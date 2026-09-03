/**
 * KWADER Desktop Pro — Renderer (Main JS)
 * JavaScript ↔ Python PyWebView Bridge
 */

'use strict';

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────
const State = {
  currentPage: 'dashboard',
  lang: 'ar',
  employees: [],
  devices: [],
  currentPayrollRunId: null,
  updateUrl: null,
  adUrl: null,
  upsellUrl: null,
};

// ─────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────
const I18N = {
  ar: {
    desktopPro: 'Desktop Pro',
    main: 'الرئيسية',
    hr: 'الموارد البشرية',
    system: 'النظام',
    dashboard: 'لوحة التحكم',
    attendance: 'سجل الحضور',
    employees: 'الموظفون',
    payroll: 'المرتبات',
    devices: 'أجهزة البصمة',
    notifications: 'الإشعارات',
    settings: 'الإعدادات',
    offline: 'غير متصل',
    online: 'متصل بالإنترنت',
    totalEmployees: 'إجمالي الموظفين',
    presentToday: 'حاضرون اليوم',
    absentToday: 'غائبون اليوم',
    attendanceRate: 'نسبة الحضور',
    noRecentPunch: 'لا توجد بصمات حديثة',
    todayStatus: 'حالة اليوم',
    lastPunch: 'آخر بصمة',
    devicesStatus: 'حالة الأجهزة',
    manageDevices: 'إدارة الأجهزة',
    noDevices: 'لا توجد أجهزة مُضافة',
    addDeviceHint: 'أضف جهاز بصمة للبدء في تتبع الحضور تلقائياً',
    addEmployee: 'إضافة موظف',
    editEmployee: 'تعديل موظف',
    name: 'الاسم',
    nameEn: 'الاسم بالإنجليزية',
    department: 'الإدارة',
    jobTitle: 'المسمى الوظيفي',
    baseSalary: 'الراتب الأساسي',
    devicePin: 'PIN الجهاز',
    status: 'الحالة',
    actions: 'إجراءات',
    active: 'نشط',
    inactive: 'موقوف',
    terminated: 'منتهي',
    noEmployees: 'لا يوجد موظفون',
    addFirstEmployee: 'ابدأ بإضافة أول موظف في شركتك',
    searchEmployees: 'بحث عن موظف...',
    allStatus: 'جميع الحالات',
    empNumber: 'رقم الموظف',
    from: 'من',
    to: 'إلى',
    search: 'بحث',
    addManual: 'إدخال يدوي',
    processLogs: 'معالجة السجلات',
    date: 'التاريخ',
    checkIn: 'الدخول',
    checkOut: 'الخروج',
    worked: 'مدة العمل',
    overtime: 'أوفرتايم',
    source: 'المصدر',
    manual: 'يدوي',
    device: 'جهاز',
    selectPeriod: 'اختر الفترة الزمنية وابحث',
    newPayrollRun: 'تشغيل دورة راتب جديدة',
    periodFrom: 'من',
    periodTo: 'إلى',
    calculatePayroll: 'احسب المرتبات',
    totalGross: 'الإجمالي',
    totalDeductions: 'الخصومات',
    totalNet: 'الصافي الكلي',
    approve: 'اعتماد',
    export: 'تصدير PDF',
    workedDays: 'أيام العمل',
    allowances: 'الإضافات',
    gross: 'الإجمالي',
    deductions: 'الخصومات',
    net: 'الصافي',
    log: 'الخطوات',
    previousRuns: 'الدورات السابقة',
    period: 'الفترة',
    noPayrollRuns: 'لا توجد دورات رواتب',
    addDevice: 'إضافة جهاز',
    devicesHint: 'أضف أجهزة البصمة لبدء المزامنة التلقائية',
    deviceName: 'اسم الجهاز',
    deviceType: 'نوع الجهاز',
    deviceIp: 'عنوان IP',
    port: 'المنفذ',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    syncInterval: 'فترة المزامنة (دقائق)',
    testConnection: 'اختبار الاتصال',
    syncLog: 'سجل المزامنة',
    clear: 'مسح',
    logReady: '[جاهز] سيظهر هنا سجل المزامنة',
    notifHint: 'الإشعارات الواردة عند الاتصال بالإنترنت',
    checkUpdates: 'تحقق من التحديثات',
    companySettings: 'إعدادات الشركة',
    companyName: 'اسم الشركة',
    companyNameEn: 'الاسم بالإنجليزية',
    country: 'الدولة',
    currency: 'العملة',
    save: 'حفظ',
    appSettings: 'إعدادات التطبيق',
    language: 'اللغة',
    autoStartOnBoot: 'التشغيل مع بدء Windows',
    license: 'الترخيص السحابي',
    licenseKey: 'مفتاح الترخيص',
    verify: 'تحقق',
    cancel: 'إلغاء',
    salaryInfo: 'معلومات الراتب',
    housingAllowance: 'بدل السكن',
    transportAllowance: 'بدل النقل',
    mealAllowance: 'بدل الوجبات',
    socialInsurance: 'تأمينات (%)',
    taxRate: 'ضريبة الدخل (%)',
    nationalId: 'الرقم القومي',
    phone: 'رقم الهاتف',
    hireDate: 'تاريخ التوظيف',
    employee: 'الموظف',
    notes: 'ملاحظات',
    addManualAttendance: 'إدخال حضور يدوي',
    calculationDetails: 'تفاصيل الحساب',
    upgradeNow: 'ترقية الآن',
    edit: 'تعديل',
    delete: 'حذف',
    deleteConfirm: 'هل أنت متأكد من حذف هذا الموظف؟',
    startSync: 'بدء المزامنة',
    stopSync: 'إيقاف المزامنة',
    syncNow: 'مزامنة الآن',
    syncing: 'يتزامن...',
    lastSync: 'آخر مزامنة',
    never: 'لم تتم بعد',
    connected: 'متصل',
    disconnected: 'غير متصل',
    error: 'خطأ',
    present: 'حاضر',
    absent: 'غائب',
    late: 'متأخر',
    hours: 'ساعة',
    minutes: 'دقيقة',
    employees2: 'موظف',
  },
  en: {
    desktopPro: 'Desktop Pro',
    main: 'Main',
    hr: 'Human Resources',
    system: 'System',
    dashboard: 'Dashboard',
    attendance: 'Attendance',
    employees: 'Employees',
    payroll: 'Payroll',
    devices: 'Fingerprint Devices',
    notifications: 'Notifications',
    settings: 'Settings',
    offline: 'Offline',
    online: 'Connected',
    totalEmployees: 'Total Employees',
    presentToday: 'Present Today',
    absentToday: 'Absent Today',
    attendanceRate: 'Attendance Rate',
    noRecentPunch: 'No recent punches',
    todayStatus: "Today's Status",
    lastPunch: 'Last Punch',
    devicesStatus: 'Device Status',
    manageDevices: 'Manage Devices',
    noDevices: 'No devices added',
    addDeviceHint: 'Add a fingerprint device to start auto-tracking attendance',
    addEmployee: 'Add Employee',
    editEmployee: 'Edit Employee',
    name: 'Name',
    nameEn: 'Name (English)',
    department: 'Department',
    jobTitle: 'Job Title',
    baseSalary: 'Base Salary',
    devicePin: 'Device PIN',
    status: 'Status',
    actions: 'Actions',
    active: 'Active',
    inactive: 'Inactive',
    terminated: 'Terminated',
    noEmployees: 'No employees',
    addFirstEmployee: 'Start by adding your first employee',
    searchEmployees: 'Search employee...',
    allStatus: 'All Status',
    empNumber: 'Emp #',
    from: 'From',
    to: 'To',
    search: 'Search',
    addManual: 'Manual Entry',
    processLogs: 'Process Logs',
    date: 'Date',
    checkIn: 'Check In',
    checkOut: 'Check Out',
    worked: 'Worked',
    overtime: 'Overtime',
    source: 'Source',
    manual: 'Manual',
    device: 'Device',
    selectPeriod: 'Select a period and search',
    newPayrollRun: 'New Payroll Run',
    periodFrom: 'From',
    periodTo: 'To',
    calculatePayroll: 'Calculate Payroll',
    totalGross: 'Total Gross',
    totalDeductions: 'Total Deductions',
    totalNet: 'Total Net',
    approve: 'Approve',
    export: 'Export PDF',
    workedDays: 'Worked Days',
    allowances: 'Allowances',
    gross: 'Gross',
    deductions: 'Deductions',
    net: 'Net',
    log: 'Steps',
    previousRuns: 'Previous Runs',
    period: 'Period',
    noPayrollRuns: 'No payroll runs',
    addDevice: 'Add Device',
    devicesHint: 'Add fingerprint devices to start automatic sync',
    deviceName: 'Device Name',
    deviceType: 'Device Type',
    deviceIp: 'IP Address',
    port: 'Port',
    username: 'Username',
    password: 'Password',
    syncInterval: 'Sync Interval (minutes)',
    testConnection: 'Test Connection',
    syncLog: 'Sync Log',
    clear: 'Clear',
    logReady: '[Ready] Sync log will appear here',
    notifHint: 'Notifications received when connected to internet',
    checkUpdates: 'Check for Updates',
    companySettings: 'Company Settings',
    companyName: 'Company Name',
    companyNameEn: 'Company Name (English)',
    country: 'Country',
    currency: 'Currency',
    save: 'Save',
    appSettings: 'App Settings',
    language: 'Language',
    autoStartOnBoot: 'Start with Windows',
    license: 'Cloud License',
    licenseKey: 'License Key',
    verify: 'Verify',
    cancel: 'Cancel',
    salaryInfo: 'Salary Information',
    housingAllowance: 'Housing Allowance',
    transportAllowance: 'Transport Allowance',
    mealAllowance: 'Meal Allowance',
    socialInsurance: 'Social Insurance (%)',
    taxRate: 'Income Tax (%)',
    nationalId: 'National ID',
    phone: 'Phone',
    hireDate: 'Hire Date',
    employee: 'Employee',
    notes: 'Notes',
    addManualAttendance: 'Add Manual Attendance',
    calculationDetails: 'Calculation Details',
    upgradeNow: 'Upgrade Now',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this employee?',
    startSync: 'Start Sync',
    stopSync: 'Stop Sync',
    syncNow: 'Sync Now',
    syncing: 'Syncing...',
    lastSync: 'Last Sync',
    never: 'Never',
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Error',
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    hours: 'h',
    minutes: 'm',
    employees2: 'employees',
  },
};

function t(key) {
  return (I18N[State.lang] || I18N.ar)[key] || key;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
}

// ─────────────────────────────────────────────────────────────
// PyWebView Bridge
// ─────────────────────────────────────────────────────────────
let _api = null;

async function api() {
  if (_api) return _api;
  // Wait for pywebview to be ready
  let tries = 0;
  while (!window.pywebview && tries < 50) {
    await sleep(100);
    tries++;
  }
  _api = window.pywebview?.api || null;
  return _api;
}

async function call(method, ...args) {
  try {
    const a = await api();
    if (!a) throw new Error('API not available');
    return await a[method](...args);
  } catch (err) {
    console.error(`API error [${method}]:`, err);
    throw err;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────
// Event System (Python → JS)
// ─────────────────────────────────────────────────────────────
window.dispatchKwaderEvent = function (eventName, payload) {
  switch (eventName) {
    case 'new_notifications':
      updateNotifBadge(payload.count);
      toast(`🔔 ${payload.count} إشعار جديد`, 'info');
      break;
    case 'new_ad':
      showAd(payload);
      break;
    case 'app_update_available':
      showUpdateBanner(payload);
      break;
    case 'sync_complete':
      if (State.currentPage === 'dashboard') refreshDashboard();
      if (State.currentPage === 'devices') refreshDeviceStatuses();
      break;
  }
};

window.onDeviceLog = function (data) {
  appendDeviceLog(data.message, data.type);
};

// ─────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:     () => t('dashboard'),
  employees:     () => t('employees'),
  attendance:    () => t('attendance'),
  payroll:       () => t('payroll'),
  devices:       () => t('devices'),
  notifications: () => t('notifications'),
  settings:      () => t('settings'),
};

function navigate(page, navEl) {
  // Deactivate all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Activate target
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  else {
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');
  }

  State.currentPage = page;
  document.getElementById('topbar-title').textContent = PAGE_TITLES[page]?.() || page;

  // Load page data
  switch (page) {
    case 'dashboard':     loadDashboard(); break;
    case 'employees':     loadEmployees(); break;
    case 'attendance':    initAttendancePage(); break;
    case 'payroll':       loadPayrollRuns(); break;
    case 'devices':       loadDevices(); break;
    case 'notifications': loadNotifications(); break;
    case 'settings':      loadSettings(); break;
  }
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [summary, info] = await Promise.all([
      call('get_today_summary'),
      call('get_app_info'),
    ]);

    document.getElementById('stat-total').textContent   = summary.total || 0;
    document.getElementById('stat-present').textContent = summary.present || 0;
    document.getElementById('stat-absent').textContent  = summary.absent || 0;
    document.getElementById('stat-rate').textContent    = (summary.attendance_rate || 0) + '%';
    document.getElementById('dash-rate').textContent    = (summary.attendance_rate || 0) + '%';
    document.getElementById('dash-progress-bar').style.width = (summary.attendance_rate || 0) + '%';
    document.getElementById('dash-present-detail').textContent =
      `${summary.present}/${summary.total} ${t('employees2')}`;
    document.getElementById('dash-date').textContent = summary.date || '';

    // Last punch
    const lp = summary.last_punch;
    const lpEl = document.getElementById('last-punch-info');
    if (lp && lp.time) {
      lpEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-4) 0">
          <span style="font-size:40px">🖐</span>
          <div>
            <div style="font-size:20px;font-weight:700">${lp.name || t('unknown')}</div>
            <div style="color:var(--color-text-secondary);font-size:13px">
              ${formatTime(lp.time)}
            </div>
          </div>
        </div>`;
    } else {
      lpEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🖐</div>
          <div class="empty-title">${t('noRecentPunch')}</div>
        </div>`;
    }

    // Online status
    updateOnlineStatus(info.is_online);
    updateNotifBadge(info.unread_notifications);

    // Upsell check
    const stats = info.stats || {};
    if (stats.limit_reached) {
      loadUpsellBanner();
    }

    // Devices status on dashboard
    loadDashboardDevices();
  } catch (err) {
    console.error('Dashboard error', err);
  }
}

async function refreshDashboard() {
  await loadDashboard();
}

async function loadDashboardDevices() {
  const devices = await call('get_devices').catch(() => []);
  const el = document.getElementById('devices-status-list');
  if (!devices || devices.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🖥️</div>
        <div class="empty-title">${t('noDevices')}</div>
        <div class="empty-desc">${t('addDeviceHint')}</div>
      </div>`;
    return;
  }
  el.innerHTML = devices.map(d => `
    <div class="flex items-center gap-4" style="padding:var(--space-3) 0;border-bottom:1px solid var(--color-border)">
      <span style="font-size:24px">${d.device_type === 'hikvision' ? '📷' : '🖐'}</span>
      <div style="flex:1">
        <div style="font-weight:600">${esc(d.name)}</div>
        <div style="font-size:12px;color:var(--color-text-muted)">${esc(d.ip_address)}:${d.port}</div>
      </div>
      <span class="badge ${statusBadge(d.last_status)}">${statusLabel(d.last_status)}</span>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────
// Employees
// ─────────────────────────────────────────────────────────────
async function loadEmployees() {
  const search = document.getElementById('emp-search')?.value || '';
  const status = document.getElementById('emp-status-filter')?.value || '';
  try {
    const employees = await call('get_employees', status || null, search || null);
    State.employees = employees || [];
    renderEmployeesTable(State.employees);
  } catch (err) {
    showError('فشل تحميل الموظفين');
  }
}

function filterEmployees(search = null) {
  search = search !== null ? search : (document.getElementById('emp-search')?.value || '');
  const status = document.getElementById('emp-status-filter')?.value || '';
  const filtered = State.employees.filter(e => {
    const matchSearch = !search || e.name.includes(search) ||
      (e.employee_number || '').includes(search) ||
      (e.department || '').includes(search);
    const matchStatus = !status || e.status === status;
    return matchSearch && matchStatus;
  });
  renderEmployeesTable(filtered);
}

function renderEmployeesTable(employees) {
  const tbody = document.getElementById('employees-tbody');
  if (!employees || employees.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="8">
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <div class="empty-title">${t('noEmployees')}</div>
          <div class="empty-desc">${t('addFirstEmployee')}</div>
        </div>
      </td></tr>`;
    return;
  }
  tbody.innerHTML = employees.map(e => `
    <tr>
      <td><span style="font-family:monospace;font-size:12px">${esc(e.employee_number || '')}</span></td>
      <td><strong>${esc(e.name)}</strong>${e.name_en ? `<br><span class="text-sm text-muted">${esc(e.name_en)}</span>` : ''}</td>
      <td>${esc(e.department || '—')}</td>
      <td>${esc(e.job_title || '—')}</td>
      <td dir="ltr" style="text-align:end">${formatMoney(e.base_salary)}</td>
      <td><code style="font-size:12px;background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:4px">${esc(e.device_pin || '—')}</code></td>
      <td><span class="badge ${statusBadgeEmp(e.status)}">${t(e.status)}</span></td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm btn-icon" title="${t('edit')}" onclick="openEditEmployeeModal(${e.id})">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" title="${t('delete')}" onclick="deleteEmployee(${e.id}, '${esc(e.name)}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddEmployeeModal() {
  clearEmployeeForm();
  document.getElementById('employee-modal-title').textContent = t('addEmployee');
  document.getElementById('e-editing-id').value = '';
  openModal('employee-modal');
}

async function openEditEmployeeModal(empId) {
  const emp = await call('get_employee', empId);
  if (!emp) return;
  clearEmployeeForm();
  document.getElementById('employee-modal-title').textContent = t('editEmployee');
  document.getElementById('e-editing-id').value = empId;
  document.getElementById('e-name').value         = emp.name || '';
  document.getElementById('e-name-en').value      = emp.name_en || '';
  document.getElementById('e-national-id').value  = emp.national_id || '';
  document.getElementById('e-phone').value         = emp.phone || '';
  document.getElementById('e-department').value    = emp.department || '';
  document.getElementById('e-job-title').value     = emp.job_title || '';
  document.getElementById('e-hire-date').value     = emp.hire_date || '';
  document.getElementById('e-device-pin').value    = emp.device_pin || '';
  document.getElementById('e-base-salary').value   = emp.base_salary || 0;
  document.getElementById('e-housing').value       = emp.housing_allowance || 0;
  document.getElementById('e-transport').value     = emp.transport_allowance || 0;
  document.getElementById('e-meal').value          = emp.meal_allowance || 0;
  document.getElementById('e-si-pct').value        = emp.social_insurance_pct || 0;
  document.getElementById('e-tax').value           = emp.income_tax_rate || 0;
  openModal('employee-modal');
}

async function saveEmployee(e) {
  e.preventDefault();
  const editId = document.getElementById('e-editing-id').value;
  const data = {
    name:              document.getElementById('e-name').value.trim(),
    name_en:           document.getElementById('e-name-en').value.trim(),
    national_id:       document.getElementById('e-national-id').value.trim(),
    phone:             document.getElementById('e-phone').value.trim(),
    department:        document.getElementById('e-department').value.trim(),
    job_title:         document.getElementById('e-job-title').value.trim(),
    hire_date:         document.getElementById('e-hire-date').value,
    device_pin:        document.getElementById('e-device-pin').value.trim(),
    base_salary:       parseFloat(document.getElementById('e-base-salary').value) || 0,
    housing_allowance: parseFloat(document.getElementById('e-housing').value) || 0,
    transport_allowance: parseFloat(document.getElementById('e-transport').value) || 0,
    meal_allowance:    parseFloat(document.getElementById('e-meal').value) || 0,
    social_insurance_pct: parseFloat(document.getElementById('e-si-pct').value) || 0,
    income_tax_rate:   parseFloat(document.getElementById('e-tax').value) || 0,
  };

  try {
    const btn = document.getElementById('e-submit-btn');
    btn.classList.add('loading');
    btn.disabled = true;

    if (editId) {
      await call('update_employee', parseInt(editId), data);
      toast('✓ تم تحديث بيانات الموظف', 'success');
    } else {
      const result = await call('add_employee', data);
      if (result && result.error === 'limit_reached') {
        toast(`⚠️ وصلت للحد الأقصى (${result.limit} موظف). ارقَ للخطة السحابية`, 'warning');
        loadUpsellBanner();
        return;
      }
      toast('✓ تم إضافة الموظف بنجاح', 'success');
    }

    closeModal('employee-modal');
    loadEmployees();
  } catch (err) {
    toast('✗ ' + (err.message || 'خطأ'), 'error');
  } finally {
    const btn = document.getElementById('e-submit-btn');
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
  }
}

async function deleteEmployee(empId, name) {
  if (!confirm(t('deleteConfirm') + ` "${name}"?`)) return;
  await call('delete_employee', empId);
  toast('تم حذف الموظف', 'success');
  loadEmployees();
}

function clearEmployeeForm() {
  ['e-name','e-name-en','e-national-id','e-phone','e-department','e-job-title',
   'e-hire-date','e-device-pin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['e-base-salary','e-housing','e-transport','e-meal','e-si-pct','e-tax'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '0';
  });
}

// ─────────────────────────────────────────────────────────────
// Attendance
// ─────────────────────────────────────────────────────────────
function initAttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const fromEl = document.getElementById('att-date-from');
  const toEl   = document.getElementById('att-date-to');
  if (!fromEl.value) fromEl.value = today;
  if (!toEl.value)   toEl.value   = today;
  loadAttendance();
}

async function loadAttendance() {
  const from = document.getElementById('att-date-from').value;
  const to   = document.getElementById('att-date-to').value;
  if (!from || !to) return;

  try {
    const records = await call('get_attendance', from, to);
    renderAttendanceTable(records || []);
  } catch (err) {
    showError('فشل تحميل سجلات الحضور');
  }
}

function renderAttendanceTable(records) {
  const tbody = document.getElementById('attendance-tbody');
  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📅</div>
      <div class="empty-title">${t('selectPeriod')}</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = records.map(r => {
    const workedH = Math.floor((r.worked_minutes || 0) / 60);
    const workedM = (r.worked_minutes || 0) % 60;
    const otH = Math.floor((r.overtime_minutes || 0) / 60);
    return `
    <tr>
      <td><strong>${esc(r.employee_name || '—')}</strong>
          <br><span class="text-xs text-muted">${esc(r.employee_number || '')}</span></td>
      <td>${esc(r.department || '—')}</td>
      <td dir="ltr">${r.work_date || '—'}</td>
      <td dir="ltr">${formatTime(r.check_in) || '—'}</td>
      <td dir="ltr">${formatTime(r.check_out) || '—'}</td>
      <td>${workedH}${t('hours')} ${workedM}${t('minutes')}</td>
      <td>${otH > 0 ? otH + t('hours') : '—'}</td>
      <td><span class="badge ${statusBadgeAtt(r.status)}">${t(r.status)}</span></td>
      <td><span class="badge badge-neutral">${r.is_manual_override ? t('manual') : t('device')}</span></td>
    </tr>`;
  }).join('');
}

async function processRawLogs() {
  try {
    const result = await call('process_raw_logs');
    toast(`✓ تمت معالجة ${result.processed} سجل`, 'success');
    if (State.currentPage === 'attendance') loadAttendance();
    if (State.currentPage === 'dashboard')  refreshDashboard();
  } catch (err) {
    toast('✗ فشلت المعالجة', 'error');
  }
}

function openManualAttendanceModal() {
  // Populate employee select
  const sel = document.getElementById('ma-employee');
  sel.innerHTML = State.employees
    .filter(e => e.status === 'active')
    .map(e => `<option value="${e.id}">${esc(e.name)}</option>`)
    .join('');
  document.getElementById('ma-date').value = new Date().toISOString().slice(0, 10);
  openModal('manual-att-modal');
}

async function saveManualAttendance(e) {
  e.preventDefault();
  const empId    = parseInt(document.getElementById('ma-employee').value);
  const date     = document.getElementById('ma-date').value;
  const checkIn  = date + 'T' + document.getElementById('ma-in').value + ':00';
  const checkOut = document.getElementById('ma-out').value
    ? date + 'T' + document.getElementById('ma-out').value + ':00'
    : null;
  const notes    = document.getElementById('ma-notes').value;

  await call('add_manual_attendance', empId, date, checkIn, checkOut, notes);
  toast('✓ تم إضافة سجل الحضور', 'success');
  closeModal('manual-att-modal');
  loadAttendance();
}

// ─────────────────────────────────────────────────────────────
// Payroll
// ─────────────────────────────────────────────────────────────
async function runPayroll() {
  const from = document.getElementById('pr-from').value;
  const to   = document.getElementById('pr-to').value;
  if (!from || !to) { toast('اختر الفترة الزمنية أولاً', 'warning'); return; }

  const btn = document.getElementById('run-payroll-btn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const result = await call('calculate_payroll', from, to);

    if (!result || result.errors?.length && !result.items?.length) {
      toast('✗ ' + (result.errors?.join(', ') || 'خطأ'), 'error');
      return;
    }

    State.currentPayrollRunId = result.run_id;
    const totals = result.totals || {};

    document.getElementById('pr-total-gross').textContent = formatMoney(totals.gross || 0);
    document.getElementById('pr-total-ded').textContent   = formatMoney(totals.deductions || 0);
    document.getElementById('pr-total-net').textContent   = formatMoney(totals.net || 0);
    document.getElementById('payroll-result-panel').classList.remove('hidden');

    renderPayrollItems(result.items || []);
    loadPayrollRuns();

    if (result.errors?.length) {
      toast('⚠️ ' + result.errors.join(' | '), 'warning');
    } else {
      toast('✓ تم حساب المرتبات بنجاح', 'success');
    }
  } catch (err) {
    toast('✗ ' + (err.message || 'خطأ'), 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function renderPayrollItems(items) {
  const tbody = document.getElementById('payroll-items-tbody');
  tbody.innerHTML = items.map(item => {
    const allowances = (item.housing_allowance || 0) + (item.transport_allowance || 0)
      + (item.meal_allowance || 0) + (item.other_allowances || 0);
    return `
    <tr>
      <td>
        <strong>${esc(item.employee_name || '')}</strong>
        <br><span class="text-xs text-muted">${esc(item.department || '')}</span>
      </td>
      <td>${item.worked_days}/${item.total_working_days}</td>
      <td dir="ltr">${formatMoney(item.base_salary)}</td>
      <td dir="ltr">${formatMoney(allowances)}</td>
      <td dir="ltr">${item.overtime_hours > 0 ? formatMoney(item.overtime_pay) : '—'}</td>
      <td dir="ltr"><strong>${formatMoney(item.gross_pay)}</strong></td>
      <td dir="ltr" style="color:var(--color-error)">${formatMoney(item.total_deductions)}</td>
      <td dir="ltr"><strong style="color:var(--color-success)">${formatMoney(item.net_pay)}</strong></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="showPayrollLog(${item.employee_id})">📋</button>
      </td>
    </tr>`;
  }).join('');
}

async function approvePayroll() {
  if (!State.currentPayrollRunId) return;
  await call('approve_payroll', State.currentPayrollRunId);
  toast('✓ تم اعتماد كشف الرواتب', 'success');
  loadPayrollRuns();
}

async function exportPayroll() {
  if (!State.currentPayrollRunId) return;
  try {
    const path = await call('export_payroll_html', State.currentPayrollRunId);
    toast('✓ تم التصدير: ' + path, 'success');
    await call('open_url', 'file:///' + path.replace(/\\/g, '/'));
  } catch (err) {
    toast('✗ فشل التصدير', 'error');
  }
}

async function loadPayrollRuns() {
  const runs = await call('get_payroll_runs').catch(() => []);
  const tbody = document.getElementById('payroll-runs-tbody');
  if (!runs || !runs.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <div class="empty-icon">💰</div>
      <div class="empty-title">${t('noPayrollRuns')}</div>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = runs.map(r => `
    <tr>
      <td dir="ltr">${r.period_start} → ${r.period_end}</td>
      <td>${r.employee_count}</td>
      <td dir="ltr">${formatMoney(r.total_gross)}</td>
      <td dir="ltr"><strong>${formatMoney(r.total_net)}</strong></td>
      <td><span class="badge ${runStatusBadge(r.status)}">${r.status}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="viewPayrollRun(${r.id})">👁</button>
      </td>
    </tr>
  `).join('');
}

async function viewPayrollRun(runId) {
  State.currentPayrollRunId = runId;
  const items = await call('get_payroll_items', runId);
  renderPayrollItems(items || []);
  document.getElementById('payroll-result-panel').classList.remove('hidden');
  document.getElementById('page-payroll').scrollIntoView();
}

async function showPayrollLog(empId) {
  if (!State.currentPayrollRunId) return;
  const items = await call('get_payroll_items', State.currentPayrollRunId);
  const item = items.find(i => i.employee_id === empId);
  if (!item) return;
  const log = item.calculation_log || [];
  document.getElementById('payroll-log-content').innerHTML = `
    <div style="font-weight:700;margin-bottom:var(--space-4)">${esc(item.employee_name)}</div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>البند</th><th>المعادلة</th><th>القيمة</th>
        </tr></thead>
        <tbody>
          ${log.map(step => `
            <tr>
              <td>${esc(step.name)}</td>
              <td style="font-size:11px;color:var(--color-text-muted)">${esc(step.formula)}</td>
              <td dir="ltr" style="text-align:end;font-family:monospace">${formatMoney(step.value)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  openModal('payroll-log-modal');
}

// ─────────────────────────────────────────────────────────────
// Devices
// ─────────────────────────────────────────────────────────────
async function loadDevices() {
  try {
    State.devices = await call('get_devices') || [];
    renderDevicesGrid(State.devices);
  } catch (err) {
    showError('فشل تحميل الأجهزة');
  }
}

function renderDevicesGrid(devices) {
  const el = document.getElementById('devices-grid');
  if (!devices.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🖥️</div>
        <div class="empty-title">${t('noDevices')}</div>
        <div class="empty-desc">${t('addDeviceHint')}</div>
      </div>`;
    return;
  }

  el.innerHTML = devices.map(d => `
    <div class="card" id="device-card-${d.id}">
      <div class="flex items-center gap-4">
        <span style="font-size:32px">${d.device_type === 'hikvision' ? '📷' : '🖐'}</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:15px">${esc(d.name)}</div>
          <div class="text-sm text-muted" dir="ltr">${esc(d.ip_address)}:${d.port}</div>
          <div class="text-xs text-muted">
            ${t('lastSync')}: ${d.last_sync ? formatTime(d.last_sync) : t('never')}
          </div>
        </div>
        <div class="flex flex-col items-center gap-2">
          <span class="badge ${statusBadge(d.last_status)}" id="dev-status-${d.id}">
            ${statusLabel(d.last_status)}
          </span>
        </div>
      </div>
      <div class="flex gap-3 mt-4">
        <button class="btn btn-primary btn-sm" id="sync-btn-${d.id}" onclick="startSync(${d.id})">
          🔄 ${t('startSync')}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="syncNow(${d.id})">
          ⚡ ${t('syncNow')}
        </button>
        <button class="btn btn-ghost btn-sm" onclick="testDeviceConnection(${d.id})">
          🔌 ${t('testConnection')}
        </button>
        <button class="btn btn-danger btn-sm btn-icon ms-auto" onclick="deleteDevice(${d.id}, '${esc(d.name)}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function refreshDeviceStatuses() {
  const statuses = await call('get_all_device_statuses').catch(() => ({}));
  for (const [id, status] of Object.entries(statuses)) {
    const el = document.getElementById(`dev-status-${id}`);
    if (el) {
      el.className = `badge ${statusBadge(status.last_status)}`;
      el.textContent = statusLabel(status.last_status);
    }
  }
}

function openAddDeviceModal() {
  document.getElementById('d-name').value     = '';
  document.getElementById('d-ip').value       = '';
  document.getElementById('d-port').value     = '4370';
  document.getElementById('d-interval').value = '5';
  document.getElementById('d-username').value = 'admin';
  document.getElementById('d-password').value = '';
  document.getElementById('d-editing-id').value = '';
  document.getElementById('d-test-result').textContent = '';
  document.getElementById('d-hik-fields').classList.add('hidden');
  document.getElementById('d-type').value = 'zkteco';
  openModal('device-modal');
}

function toggleDeviceFields() {
  const type = document.getElementById('d-type').value;
  const hikFields = document.getElementById('d-hik-fields');
  const portEl = document.getElementById('d-port');
  if (type === 'hikvision') {
    hikFields.classList.remove('hidden');
    portEl.value = '80';
  } else {
    hikFields.classList.add('hidden');
    portEl.value = '4370';
  }
}

async function testDeviceBeforeAdd() {
  const ip   = document.getElementById('d-ip').value.trim();
  const port = parseInt(document.getElementById('d-port').value) || 4370;
  const type = document.getElementById('d-type').value;
  const result_el = document.getElementById('d-test-result');
  result_el.textContent = '⏳ جاري الاختبار...';

  try {
    let result;
    if (type === 'hikvision') {
      result = await call('test_device_connection', -1);  // will be temp tested inline
    } else {
      // Create temp and test
      const tempDevice = { ip_address: ip, port, device_type: type, username: 'admin', password: '', use_https: false };
      const d = await call('add_device', { name: '__temp__', ip_address: ip, port, device_type: type });
      if (d && d.id) {
        result = await call('test_device_connection', d.id);
        await call('delete_device', d.id);
      }
    }
    if (result?.success) {
      result_el.innerHTML = `<span style="color:var(--color-success)">✓ ${esc(result.message)}</span>`;
    } else {
      result_el.innerHTML = `<span style="color:var(--color-error)">✗ ${esc(result?.message || 'فشل')}</span>`;
    }
  } catch (err) {
    result_el.innerHTML = `<span style="color:var(--color-error)">✗ ${esc(err.message || 'خطأ')}</span>`;
  }
}

async function saveDevice(e) {
  e.preventDefault();
  const data = {
    name:             document.getElementById('d-name').value.trim(),
    device_type:      document.getElementById('d-type').value,
    ip_address:       document.getElementById('d-ip').value.trim(),
    port:             parseInt(document.getElementById('d-port').value),
    username:         document.getElementById('d-username').value.trim(),
    password:         document.getElementById('d-password').value,
    sync_interval_min: parseInt(document.getElementById('d-interval').value) || 5,
  };
  await call('add_device', data);
  toast('✓ تم إضافة الجهاز', 'success');
  closeModal('device-modal');
  loadDevices();
}

async function startSync(deviceId) {
  const btn = document.getElementById(`sync-btn-${deviceId}`);
  if (btn) {
    btn.textContent = `⏸ ${t('stopSync')}`;
    btn.onclick = () => stopSync(deviceId);
  }
  await call('start_device_sync', deviceId);
  toast('✓ بدأت المزامنة التلقائية', 'success');
}

async function stopSync(deviceId) {
  const btn = document.getElementById(`sync-btn-${deviceId}`);
  if (btn) {
    btn.textContent = `🔄 ${t('startSync')}`;
    btn.onclick = () => startSync(deviceId);
  }
  await call('stop_device_sync', deviceId);
  toast('المزامنة متوقفة', 'warning');
}

async function syncNow(deviceId) {
  toast('⚡ جاري المزامنة الفورية...', 'info');
  await call('sync_device_now', deviceId);
}

async function testDeviceConnection(deviceId) {
  toast('⏳ جاري الاختبار...', 'info');
  const result = await call('test_device_connection', deviceId);
  if (result?.success) {
    toast('✓ ' + result.message, 'success');
  } else {
    toast('✗ ' + (result?.message || 'فشل الاتصال'), 'error');
  }
}

async function deleteDevice(deviceId, name) {
  if (!confirm(`هل تريد حذف الجهاز "${name}"؟`)) return;
  await call('delete_device', deviceId);
  toast('تم حذف الجهاز', 'success');
  loadDevices();
}

function appendDeviceLog(message, type = 'info') {
  const logBody = document.getElementById('device-log-body');
  if (!logBody) return;
  const now = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const el = document.createElement('div');
  el.className = `log-entry ${type}`;
  el.innerHTML = `<span class="log-time">${now}</span><span class="log-msg">${esc(message)}</span>`;
  logBody.appendChild(el);
  logBody.scrollTop = logBody.scrollHeight;

  // Auto-trim if too long
  while (logBody.children.length > 200) {
    logBody.removeChild(logBody.firstChild);
  }
}

// ─────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────
async function loadNotifications() {
  const notifs = await call('get_notifications').catch(() => []);
  const el = document.getElementById('notifications-list');
  if (!notifs || !notifs.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🔔</div>
      <div class="empty-title">لا توجد إشعارات</div>
    </div>`;
    return;
  }
  el.innerHTML = notifs.map(n => `
    <div class="card flex items-center gap-4 ${n.is_read ? 'text-muted' : ''}"
         style="${!n.is_read ? 'border-color:rgba(108,99,255,0.3)' : ''}">
      <span style="font-size:24px">${notifIcon(n.type)}</span>
      <div style="flex:1">
        <div style="font-weight:${n.is_read ? '400' : '600'}">${esc(n.title)}</div>
        <div class="text-sm text-muted">${esc(n.body || '')}</div>
        <div class="text-xs text-muted">${formatTime(n.received_at)}</div>
      </div>
      <div class="flex gap-2">
        ${n.action_url ? `<button class="btn btn-primary btn-sm" onclick="call('open_url','${n.action_url}')">فتح</button>` : ''}
        ${!n.is_read ? `<button class="btn btn-ghost btn-sm" onclick="markRead('${n.id}')">✓</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function markRead(id) {
  await call('mark_notification_read', id);
  loadNotifications();
  const count = await call('get_app_info').then(i => i.unread_notifications || 0).catch(() => 0);
  updateNotifBadge(count);
}

async function checkForUpdates() {
  await call('check_for_updates');
  toast('⏳ جاري التحقق...', 'info');
}

// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────
async function loadSettings() {
  const company = await call('get_company').catch(() => ({}));
  document.getElementById('s-company-name').value    = company.name || '';
  document.getElementById('s-company-name-en').value = company.name_en || '';
  document.getElementById('s-country').value         = company.country || 'EG';
  document.getElementById('s-currency').value        = company.currency || 'EGP';

  const autoStart = await call('get_auto_start').catch(() => false);
  document.getElementById('s-autostart').checked = !!autoStart;

  document.getElementById('s-language').value = State.lang;

  const licKey = await call('get_settings').then(s => s.licenseKey || '').catch(() => '');
  document.getElementById('s-license-key').value = licKey;
}

async function saveCompanySettings(e) {
  e.preventDefault();
  await call('update_company', {
    name:     document.getElementById('s-company-name').value.trim(),
    name_en:  document.getElementById('s-company-name-en').value.trim(),
    country:  document.getElementById('s-country').value,
    currency: document.getElementById('s-currency').value,
  });
  toast('✓ تم حفظ إعدادات الشركة', 'success');
}

async function setLanguage(lang) {
  State.lang = lang;
  await call('set_language', lang);
  const html = document.documentElement;
  if (lang === 'en') {
    html.setAttribute('lang', 'en');
    html.setAttribute('dir', 'ltr');
    document.body.setAttribute('lang', 'en');
    document.getElementById('lang-toggle').textContent = '🌐 العربية';
  } else {
    html.setAttribute('lang', 'ar');
    html.setAttribute('dir', 'rtl');
    document.body.removeAttribute('lang');
    document.getElementById('lang-toggle').textContent = '🌐 English';
  }
  applyI18n();
}

function toggleLanguage() {
  setLanguage(State.lang === 'ar' ? 'en' : 'ar');
}

async function setAutoStart(enabled) {
  await call('set_auto_start', enabled);
  toast(enabled ? '✓ سيتشغل التطبيق مع بدء Windows' : 'تم إيقاف التشغيل التلقائي', 'success');
}

async function verifyLicense() {
  const key = document.getElementById('s-license-key').value.trim();
  if (!key) return;
  const btn = document.querySelector('#page-settings button[onclick="verifyLicense()"]');
  if (btn) { btn.classList.add('loading'); btn.disabled = true; }

  try {
    const result = await call('verify_license', key);
    const el = document.getElementById('license-status');
    el.classList.remove('hidden');
    if (result.valid) {
      el.innerHTML = `<span class="text-success">✓ ترخيص نشط — ${esc(result.company_name || '')}</span>`;
      toast('✓ تم التحقق من الترخيص', 'success');
    } else {
      el.innerHTML = `<span class="text-error">✗ ${esc(result.message || 'مفتاح غير صالح')}</span>`;
    }
  } finally {
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
  }
}

// ─────────────────────────────────────────────────────────────
// Cloud Ads & Upsell
// ─────────────────────────────────────────────────────────────
function showAd(ad) {
  if (!ad) return;
  State.adUrl = ad.cta_url || null;
  document.getElementById('ad-title').textContent = ad.title || '';
  document.getElementById('ad-desc').textContent  = ad.description || '';
  const ctaBtn = document.getElementById('ad-cta-btn');
  ctaBtn.textContent = ad.cta_text || 'اعرف أكثر';
  ctaBtn.style.display = ad.cta_url ? '' : 'none';
  document.getElementById('ad-banner').classList.remove('hidden');
}

function openAdUrl() {
  if (State.adUrl) call('open_url', State.adUrl);
}

async function loadUpsellBanner() {
  const banner = await call('get_upsell_banner').catch(() => null);
  if (!banner) {
    // Show default upsell
    document.getElementById('upsell-banner').classList.remove('hidden');
    return;
  }
  State.upsellUrl = banner.cta_url || 'https://kwader-system.web.app';
  document.getElementById('upsell-title').textContent = banner.title || 'ارقَ إلى الخطة السحابية';
  document.getElementById('upsell-desc').textContent  = banner.description || '';
  document.getElementById('upsell-banner').classList.remove('hidden');
}

function openUpsellUrl() {
  call('open_url', State.upsellUrl || 'https://kwader-system.web.app');
}

function showUpdateBanner(info) {
  State.updateUrl = info.download_url || null;
  document.getElementById('update-text').textContent =
    `🎉 إصدار جديد ${info.latest} متاح! (أنت على ${info.current})`;
  document.getElementById('update-banner').classList.remove('hidden');
}

function openUpdateUrl() {
  if (State.updateUrl) call('open_url', State.updateUrl);
}

// ─────────────────────────────────────────────────────────────
// Modal Helpers
// ─────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.add('hidden');
  }
});

// ─────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-20px)';
    el.style.transition = '0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function showError(msg) {
  toast('✗ ' + msg, 'error');
}

// ─────────────────────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────────────────────
function updateOnlineStatus(isOnline) {
  const dot   = document.getElementById('online-dot');
  const label = document.getElementById('online-label');
  if (isOnline) {
    dot.classList.add('online');
    label.textContent = t('online');
  } else {
    dot.classList.remove('online');
    label.textContent = t('offline');
  }
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ar-EG');
  } catch {
    return iso;
  }
}

function statusBadge(status) {
  const map = { ok: 'badge-success', syncing: 'badge-info', error: 'badge-error',
                stopped: 'badge-neutral', unknown: 'badge-neutral' };
  return map[status] || 'badge-neutral';
}

function statusLabel(status) {
  const map = { ok: t('connected'), syncing: t('syncing'), error: t('error'),
                stopped: t('disconnected'), unknown: '—' };
  return map[status] || status || '—';
}

function statusBadgeEmp(status) {
  const map = { active: 'badge-success', inactive: 'badge-warning', terminated: 'badge-error' };
  return map[status] || 'badge-neutral';
}

function statusBadgeAtt(status) {
  const map = { present: 'badge-success', late: 'badge-warning', absent: 'badge-error',
                half_day: 'badge-warning' };
  return map[status] || 'badge-neutral';
}

function runStatusBadge(status) {
  const map = { draft: 'badge-neutral', approved: 'badge-success', locked: 'badge-info' };
  return map[status] || 'badge-neutral';
}

function notifIcon(type) {
  const map = { info: '💡', success: '✅', warning: '⚠️', error: '❌', ad: '📢' };
  return map[type] || '🔔';
}

// ─────────────────────────────────────────────────────────────
// Init on Load
// ─────────────────────────────────────────────────────────────
async function init() {
  // Get language from Python settings
  try {
    const lang = await call('get_language');
    if (lang && lang !== State.lang) {
      await setLanguage(lang);
    }
  } catch (e) {}

  applyI18n();

  // Set default dates
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = today.slice(0, 8) + '01';
  const prFrom = document.getElementById('pr-from');
  const prTo   = document.getElementById('pr-to');
  if (prFrom && !prFrom.value) prFrom.value = firstDay;
  if (prTo   && !prTo.value)   prTo.value   = today;

  // Load dashboard
  navigate('dashboard', document.querySelector('.nav-item[data-page="dashboard"]'));

  // Periodic refresh every 60s
  setInterval(() => {
    if (State.currentPage === 'dashboard') refreshDashboard();
    if (State.currentPage === 'devices')   refreshDeviceStatuses();
  }, 60000);

  // Check online status every 30s
  setInterval(async () => {
    try {
      const info = await call('get_cloud_status');
      updateOnlineStatus(info.is_online);
    } catch {}
  }, 30000);
}

// Wait for pywebview API to be ready, then init
if (window.pywebview) {
  window.addEventListener('pywebviewready', init);
} else {
  window.addEventListener('pywebviewready', init);
  // Fallback for browser testing
  setTimeout(() => {
    if (!window.pywebview) {
      console.warn('Running without pywebview (browser mode)');
      init();
    }
  }, 2000);
}
