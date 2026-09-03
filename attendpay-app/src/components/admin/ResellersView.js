import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Filter, MoreVertical, Mail, Phone, Calendar, Building2, X, DollarSign, Award } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';

export function ResellersView() {
  const { language } = useLocale();
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReseller, setNewReseller] = useState({ name: '', email: '', phone: '' });

  // Edit Reseller Modal States
  const [editingReseller, setEditingReseller] = useState(null);
  const [commissionRate, setCommissionRate] = useState(30);

  // Edit Reseller Details Modal States
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [resellerToEdit, setResellerToEdit] = useState(null);
  const [editResellerForm, setEditResellerForm] = useState({ name: '', email: '', phone: '' });

  // Delete Reseller Modal States
  const [resellerToDelete, setResellerToDelete] = useState(null);

  // Dropdown menu state per reseller
  const [activeDropdown, setActiveDropdown] = useState(null);

  useEffect(() => {
    fetchResellers();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = () => setActiveDropdown(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const fetchResellers = async () => {
    setLoading(true);
    try {
      // Fetch resellers along with their associated companies and subscription info
      const { data, error } = await supabase
        .from('resellers')
        .select('*, companies(id, status, plan, subscription_amount)')
        .order('created_at', { ascending: false });

      if (!error) setResellers(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReseller = async (e) => {
    e.preventDefault();
    if (!newReseller.name || !newReseller.email) return;

    setActionLoading('add');
    try {
      const { data, error } = await supabase
        .from('resellers')
        .insert([{
          name: newReseller.name,
          email: newReseller.email,
          phone: newReseller.phone,
          status: 'active',
          settings: { commission_rate: 30 }
        }])
        .select();

      if (!error && data) {
        // Fetch fresh list to include companies relationship
        await fetchResellers();
        setShowAddForm(false);
        setNewReseller({ name: '', email: '', phone: '' });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateReseller = async (e) => {
    e.preventDefault();
    if (!resellerToEdit || !editResellerForm.name || !editResellerForm.email) return;

    setActionLoading(`edit-${resellerToEdit.id}`);
    try {
      const { error } = await supabase
        .from('resellers')
        .update({
          name: editResellerForm.name,
          email: editResellerForm.email,
          phone: editResellerForm.phone
        })
        .eq('id', resellerToEdit.id);

      if (!error) {
        setResellers(prev => prev.map(r => r.id === resellerToEdit.id ? { 
          ...r, 
          name: editResellerForm.name, 
          email: editResellerForm.email, 
          phone: editResellerForm.phone 
        } : r));
        setShowEditDetails(false);
        setResellerToEdit(null);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteReseller = async () => {
    if (!resellerToDelete) return;

    setActionLoading(`delete-${resellerToDelete.id}`);
    try {
      const { error } = await supabase
        .from('resellers')
        .delete()
        .eq('id', resellerToDelete.id);

      if (!error) {
        setResellers(prev => prev.filter(r => r.id !== resellerToDelete.id));
        setResellerToDelete(null);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    setActionLoading(id);
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const { error } = await supabase
        .from('resellers')
        .update({ status: newStatus })
        .eq('id', id);

      if (!error) {
        setResellers(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveCommission = async () => {
    if (!editingReseller) return;
    const updatedSettings = { ...editingReseller.settings, commission_rate: commissionRate };
    
    setActionLoading(`comm-${editingReseller.id}`);
    try {
      const { error } = await supabase
        .from('resellers')
        .update({ settings: updatedSettings })
        .eq('id', editingReseller.id);

      if (!error) {
        setResellers(prev => prev.map(r => r.id === editingReseller.id ? { ...r, settings: updatedSettings } : r));
        setEditingReseller(null);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = resellers.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase())
  );

  // Calculated Overall Metrics
  const totalSales = resellers.reduce((sum, r) => {
    const rSales = r.companies?.reduce((acc, c) => acc + (parseFloat(c.subscription_amount) || 0), 0) || 0;
    return sum + rSales;
  }, 0);

  const totalCommissions = resellers.reduce((sum, r) => {
    const rate = r.settings?.commission_rate ?? 30;
    const rSales = r.companies?.reduce((acc, c) => acc + (parseFloat(c.subscription_amount) || 0), 0) || 0;
    return sum + (rSales * (rate / 100));
  }, 0);

  return (
    <div className="space-y-6" style={{ textAlign: 'right', direction: 'rtl' }}>
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Resellers Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors duration-300" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="text-right flex-1">
              <div className="text-2xl font-bold text-gray-900 mb-0.5">{resellers.length}</div>
              <div className="text-slate-500 text-xs font-semibold">
                {language === 'en' ? 'Total Resellers' : 'إجمالي الموزعين'}
              </div>
            </div>
          </div>
        </div>

        {/* Total Sales Value Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors duration-300" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="text-right flex-1">
              <div className="text-2xl font-bold text-gray-900 mb-0.5">{totalSales.toLocaleString()} ج.م</div>
              <div className="text-slate-500 text-xs font-semibold">
                {language === 'en' ? 'Reseller Sales MRR' : 'إجمالي مبيعات الموزعين'}
              </div>
            </div>
          </div>
        </div>

        {/* Total Payouts Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-violet-500/5 group-hover:bg-violet-500/10 transition-colors duration-300" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0 border border-violet-100">
              <Award className="w-6 h-6" />
            </div>
            <div className="text-right flex-1">
              <div className="text-2xl font-bold text-gray-900 mb-0.5">{totalCommissions.toLocaleString()} ج.م</div>
              <div className="text-slate-500 text-xs font-semibold">
                {language === 'en' ? 'Total Payouts' : 'إجمالي العمولات المستحقة'}
              </div>
            </div>
          </div>
        </div>

        {/* Add Reseller Trigger Card */}
        <div 
          className="bg-white rounded-2xl p-5 border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/10 transition-all flex items-center justify-center cursor-pointer group" 
          onClick={() => setShowAddForm(true)}
        >
          <div className="flex items-center gap-3 relative z-10 text-blue-600 group-hover:text-blue-700">
            <Plus className="w-5 h-5" />
            <div className="text-sm font-bold">
              {language === 'en' ? 'Add New Reseller' : 'إضافة موزع جديد'}
            </div>
          </div>
        </div>
      </div>

      {/* Main List Area */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[500px]">
        {/* Table Header / Filters */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 text-slate-500 transition-colors">
              <Filter className="w-4 h-4" />
            </div>
          </div>

          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={language === 'en' ? 'Search resellers...' : 'بحث عن موزع (الحساب أو البريد)...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-right pl-4 pr-10 py-2.5 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold"
            />
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-500">
                {language === 'en' ? 'Loading reseller data...' : 'جاري تحميل بيانات الموزعين...'}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-450">
                <Building2 className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-500">
                {language === 'en' ? 'No resellers match your search' : 'لا يوجد موزعين يطابقون بحثك'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(reseller => {
                const resellerSales = reseller.companies?.reduce((acc, c) => acc + (parseFloat(c.subscription_amount) || 0), 0) || 0;
                const resellerRate = reseller.settings?.commission_rate ?? 30;
                const resellerProfit = resellerSales * (resellerRate / 100);

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={reseller.id}
                    className="bg-white rounded-xl p-4 hover:bg-blue-50/10 transition-all border border-gray-100 hover:border-blue-200 shadow-3xs flex flex-col"
                  >
                    {/* Top Row: General Info & Actions */}
                    <div className="flex items-center gap-4">
                      {/* Reseller Initial Badge */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-md text-white font-bold text-sm">
                        {reseller.name ? reseller.name.charAt(0).toUpperCase() : '?'}
                      </div>

                      {/* Reseller Info */}
                      <div className="flex-1 text-right min-w-0">
                        <h4 className="text-gray-900 font-bold truncate text-sm mb-1">{reseller.name}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-500 justify-end font-semibold flex-wrap">
                          <div className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span className="truncate max-w-[180px] font-medium" style={{ direction: 'ltr' }}>{reseller.email}</span>
                          </div>
                          {reseller.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              <span className="font-medium" style={{ direction: 'ltr' }}>{reseller.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status & Date Info */}
                      <div className="w-32 flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold ${
                          reseller.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : reseller.status === 'suspended' 
                              ? 'bg-red-50 text-red-700 border border-red-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {reseller.status === 'active' 
                            ? (language === 'en' ? 'Active' : 'نشط') 
                            : reseller.status === 'suspended' 
                              ? (language === 'en' ? 'Suspended' : 'معلق') 
                              : (language === 'en' ? 'Pending' : 'قيد الانتظار')}
                        </span>
                        <div className="flex items-center gap-1 text-[0.65rem] text-slate-400 font-bold">
                          <span>{new Date(reseller.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA')}</span>
                          <Calendar className="w-3.5 h-3.5 text-slate-350" />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0 relative">
                        <button
                          onClick={() => toggleStatus(reseller.id, reseller.status)}
                          disabled={actionLoading === reseller.id}
                          className={`h-8 px-3 rounded-lg text-xs font-bold transition-all border ${
                            reseller.status === 'active'
                              ? 'bg-amber-50 text-amber-650 border-amber-150 hover:bg-amber-100/70'
                              : 'bg-emerald-50 text-emerald-650 border-emerald-150 hover:bg-emerald-100/70'
                          }`}
                        >
                          {actionLoading === reseller.id 
                            ? '...' 
                            : reseller.status === 'active' 
                              ? (language === 'en' ? 'Suspend' : 'تجميد الموزع') 
                              : (language === 'en' ? 'Activate' : 'تفعيل الموزع')}
                        </button>
                        
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === reseller.id ? null : reseller.id);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-255 text-slate-500 hover:text-slate-800 hover:bg-gray-150 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          <AnimatePresence>
                            {activeDropdown === reseller.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute left-0 mt-1.5 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-20 py-1.5 text-right font-semibold"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => {
                                    setResellerToEdit(reseller);
                                    setEditResellerForm({
                                      name: reseller.name || '',
                                      email: reseller.email || '',
                                      phone: reseller.phone || ''
                                    });
                                    setShowEditDetails(true);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-right flex items-center justify-between"
                                >
                                  <span>{language === 'en' ? 'Edit Reseller Info' : 'تعديل بيانات الموزع'}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setResellerToDelete(reseller);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-right flex items-center justify-between"
                                >
                                  <span>{language === 'en' ? 'Delete Reseller' : 'حذف الموزع نهائياً'}</span>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Performance & Commission Stats */}
                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-right">
                      {/* Referrals Count */}
                      <div>
                        <div className="text-gray-400 text-[0.68rem] font-bold">
                          {language === 'en' ? 'Referrals / Subscriptions' : 'العملاء / الاشتراكات'}
                        </div>
                        <div className="text-gray-800 text-xs font-bold mt-1">
                          {reseller.companies?.length || 0} {language === 'en' ? 'companies' : 'شركات'} <span className="text-gray-400 font-medium">({reseller.companies?.filter(c => c.status === 'active').length || 0} {language === 'en' ? 'active' : 'نشطة'})</span>
                        </div>
                      </div>

                      {/* Total Sales MRR */}
                      <div>
                        <div className="text-gray-400 text-[0.68rem] font-bold">
                          {language === 'en' ? 'Total Subscriptions Value' : 'إجمالي مبيعات الباقات'}
                        </div>
                        <div className="text-gray-800 text-xs font-bold mt-1">
                          {resellerSales.toLocaleString()} ج.م
                        </div>
                      </div>

                      {/* Commission Percentage */}
                      <div>
                        <div className="text-gray-400 text-[0.68rem] font-bold">
                          {language === 'en' ? 'Commission Rate' : 'نسبة العمولة'}
                        </div>
                        <div className="text-gray-800 text-xs font-bold mt-1 flex items-center justify-end gap-1.5">
                          <span>{resellerRate}%</span>
                          <button
                            onClick={() => {
                              setEditingReseller(reseller);
                              setCommissionRate(resellerRate);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-[0.68rem] font-bold cursor-pointer transition-colors"
                          >
                            {language === 'en' ? 'Edit' : 'تعديل'}
                          </button>
                        </div>
                      </div>

                      {/* Net Earnings */}
                      <div>
                        <div className="text-gray-400 text-[0.68rem] font-bold">
                          {language === 'en' ? 'Net Reseller Earnings' : 'صافي أرباح الموزع'}
                        </div>
                        <div className="text-emerald-600 text-xs font-bold mt-1">
                          {resellerProfit.toLocaleString()} ج.م
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Form Modal Overlay */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setShowAddForm(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white border border-gray-100 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden z-10 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Building2 className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {language === 'en' ? 'Invite New Reseller' : 'دعوة موزع جديد'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="w-7 h-7 rounded-lg hover:bg-gray-150 flex items-center justify-center text-gray-400 hover:text-gray-650 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddReseller} className="p-6 space-y-4">
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {language === 'en' ? 'Reseller / Company Name' : 'اسم الموزع / الشركة'}
                  </label>
                  <input 
                    required 
                    value={newReseller.name} 
                    onChange={e => setNewReseller(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white rounded-xl px-4 py-2.5 text-gray-800 text-xs focus:border-blue-450 focus:ring-2 focus:ring-blue-100 outline-none text-right font-semibold transition-all"
                    placeholder={language === 'en' ? 'e.g. Digital Vision Agent' : 'مثال: الرؤية الرقمية لتجهيزات المطاعم'}
                  />
                </div>

                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {language === 'en' ? 'Agent Email Address' : 'البريد الإلكتروني للوكيل'}
                  </label>
                  <input 
                    required 
                    type="email" 
                    value={newReseller.email} 
                    onChange={e => setNewReseller(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white rounded-xl px-4 py-2.5 text-gray-800 text-xs focus:border-blue-450 focus:ring-2 focus:ring-blue-100 outline-none text-right font-semibold transition-all"
                    placeholder="agent@example.com"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {language === 'en' ? 'Contact Phone (Optional)' : 'رقم التواصل (اختياري)'}
                  </label>
                  <input 
                    value={newReseller.phone} 
                    onChange={e => setNewReseller(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white rounded-xl px-4 py-2.5 text-gray-800 text-xs focus:border-blue-450 focus:ring-2 focus:ring-blue-100 outline-none text-right font-semibold transition-all"
                    placeholder="9665xxxxxxxx"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <button 
                    type="submit" 
                    disabled={actionLoading === 'add'}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-blue-100 active:scale-[0.98]"
                  >
                    {actionLoading === 'add' ? (language === 'en' ? 'Adding...' : 'جاري الإضافة...') : (language === 'en' ? 'Save & Send Invite' : 'حفظ وإرسال الدعوة')}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    {language === 'en' ? 'Cancel' : 'إلغاء'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Reseller Details Modal Overlay */}
      <AnimatePresence>
        {showEditDetails && resellerToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => {
                setShowEditDetails(false);
                setResellerToEdit(null);
              }}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white border border-gray-100 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden z-10 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Building2 className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {language === 'en' ? 'Edit Reseller Info' : 'تعديل بيانات الموزع'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowEditDetails(false);
                    setResellerToEdit(null);
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-gray-150 flex items-center justify-center text-gray-400 hover:text-gray-650 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateReseller} className="p-6 space-y-4">
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {language === 'en' ? 'Reseller / Company Name' : 'اسم الموزع / الشركة'}
                  </label>
                  <input 
                    required 
                    value={editResellerForm.name} 
                    onChange={e => setEditResellerForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white rounded-xl px-4 py-2.5 text-gray-800 text-xs focus:border-blue-450 focus:ring-2 focus:ring-blue-100 outline-none text-right font-semibold transition-all"
                  />
                </div>

                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {language === 'en' ? 'Agent Email Address' : 'البريد الإلكتروني للوكيل'}
                  </label>
                  <input 
                    required 
                    type="email" 
                    value={editResellerForm.email} 
                    onChange={e => setEditResellerForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white rounded-xl px-4 py-2.5 text-gray-800 text-xs focus:border-blue-450 focus:ring-2 focus:ring-blue-100 outline-none text-right font-semibold transition-all"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {language === 'en' ? 'Contact Phone (Optional)' : 'رقم التواصل (اختياري)'}
                  </label>
                  <input 
                    value={editResellerForm.phone} 
                    onChange={e => setEditResellerForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white rounded-xl px-4 py-2.5 text-gray-800 text-xs focus:border-blue-450 focus:ring-2 focus:ring-blue-100 outline-none text-right font-semibold transition-all"
                    placeholder="9665xxxxxxxx"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <button 
                    type="submit" 
                    disabled={actionLoading === `edit-${resellerToEdit.id}`}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-blue-100 active:scale-[0.98]"
                  >
                    {actionLoading === `edit-${resellerToEdit.id}` ? (language === 'en' ? 'Saving...' : 'جاري الحفظ...') : (language === 'en' ? 'Save Changes' : 'حفظ التعديلات')}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowEditDetails(false);
                      setResellerToEdit(null);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    {language === 'en' ? 'Cancel' : 'إلغاء'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal Overlay */}
      <AnimatePresence>
        {resellerToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setResellerToDelete(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white border border-gray-100 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden z-10 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-red-50">
                <h3 className="font-bold text-red-700 text-sm">
                  {language === 'en' ? 'Delete Reseller Permanently' : 'حذف الموزع نهائياً'}
                </h3>
                <button
                  onClick={() => setResellerToDelete(null)}
                  className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-red-500 hover:text-red-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-right">
                <p className="text-xs text-gray-650 font-semibold leading-relaxed">
                  {language === 'en' 
                    ? `Are you sure you want to permanently delete reseller "${resellerToDelete.name}"? This action cannot be undone.` 
                    : `هل أنت متأكد من حذف الموزع "${resellerToDelete.name}" نهائياً؟ هذا الإجراء سيقوم بإزالة حسابه ومبيعاته ولا يمكن التراجع عنه.`}
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={handleDeleteReseller}
                    disabled={actionLoading === `delete-${resellerToDelete.id}`}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-red-100 active:scale-[0.98]"
                  >
                    {actionLoading === `delete-${resellerToDelete.id}` ? (language === 'en' ? 'Deleting...' : 'جاري الحذف...') : (language === 'en' ? 'Yes, Delete' : 'نعم، احذف الموزع')}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setResellerToDelete(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    {language === 'en' ? 'Cancel' : 'إلغاء'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Commission Modal Overlay */}
      <AnimatePresence>
        {editingReseller && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setEditingReseller(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white border border-gray-100 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden z-10 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Award className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {language === 'en' ? 'Edit Reseller Commission' : 'تعديل عمولة الموزع'}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingReseller(null)}
                  className="w-7 h-7 rounded-lg hover:bg-gray-150 flex items-center justify-center text-gray-400 hover:text-gray-650 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="text-right">
                  <p className="text-xs text-gray-400 mb-2">
                    {language === 'en' ? 'Reseller:' : 'الموزع:'} {editingReseller.name}
                  </p>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {language === 'en' ? 'Commission Percentage (%)' : 'نسبة العمولة (%)'}
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    max="100"
                    value={commissionRate} 
                    onChange={e => setCommissionRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white rounded-xl px-4 py-2.5 text-gray-800 text-xs focus:border-blue-450 focus:ring-2 focus:ring-blue-100 outline-none text-right font-semibold transition-all mt-1.5"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={handleSaveCommission}
                    disabled={actionLoading === `comm-${editingReseller.id}`}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-blue-100 active:scale-[0.98]"
                  >
                    {actionLoading === `comm-${editingReseller.id}` ? (language === 'en' ? 'Saving...' : 'جاري الحفظ...') : (language === 'en' ? 'Save Commission' : 'حفظ التعديل')}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setEditingReseller(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    {language === 'en' ? 'Cancel' : 'إلغاء'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
