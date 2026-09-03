import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { 
  Plus, Users, Search, Layers, ChevronDown, X, User,
  Code, Palette, HardHat, Calculator, Megaphone, Briefcase,
  Truck, Shield, GraduationCap, Stethoscope, Utensils, Zap
} from 'lucide-react';
import './Departments.css';

// -------------------------------------------------------------------------
const getDepartmentIcon = (name) => {
  if (!name) return Layers;
  const n = name.toLowerCase();
  
  if (n.includes('هندس') || n.includes('برمج') || n.includes('مهندس') || n.includes('تقني') || n.includes('it') || n.includes('tech')) return Code;
  if (n.includes('تصميم') || n.includes('فني') || n.includes('design') || n.includes('ابداع') || n.includes('إبداع')) return Palette;
  if (n.includes('عمال') || n.includes('صيان') || n.includes('تشغيل') || n.includes('نظاف') || n.includes('ورش')) return HardHat;
  if (n.includes('حساب') || n.includes('محاسب') || n.includes('مالي') || n.includes('صندوق') || n.includes('خزين')) return Calculator;
  if (n.includes('بشرية') || n.includes('hr') || n.includes('شؤون') || n.includes('موظف') || n.includes('شؤن')) return Users;
  if (n.includes('تسويق') || n.includes('مبيعات') || n.includes('بيع') || n.includes('مندوب') || n.includes('marketing') || n.includes('sales')) return Megaphone;
  if (n.includes('إدار') || n.includes('مدير') || n.includes('قياد') || n.includes('رئيس') || n.includes('ادار') || n.includes('management')) return Briefcase;
  if (n.includes('نقل') || n.includes('سائق') || n.includes('مواصل') || n.includes('توصيل') || n.includes('حرك') || n.includes('سيار') || n.includes('لوجست')) return Truck;
  if (n.includes('أمن') || n.includes('حراس') || n.includes('سلام') || n.includes('امن') || n.includes('security')) return Shield;
  if (n.includes('تعليم') || n.includes('مدرس') || n.includes('تدريس') || n.includes('تدريب') || n.includes('أكاديمي')) return GraduationCap;
  if (n.includes('طب') || n.includes('دكتور') || n.includes('طبيب') || n.includes('تمريض') || n.includes('صيادل') || n.includes('صحي')) return Stethoscope;
  if (n.includes('غذاء') || n.includes('طعام') || n.includes('مطبخ') || n.includes('طباخ') || n.includes('مطعم')) return Utensils;
  if (n.includes('كهرب') || n.includes('طاق')) return Zap;
  
  return Layers; // Default Icon
};

// -------------------------------------------------------------------------
function DepartmentModal({ dept, onClose, onSuccess, companyId, t }) {
  const [name, setName] = useState(dept ? dept.name : '');
  const [managerId, setManagerId] = useState(dept ? dept.manager_id : '');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchEmployees() {
      const { data } = await supabase
        .from('employees')
        .select('id, name')
        .eq('company_id', companyId);
      if (data) setEmployees(data);
    }
    fetchEmployees();
  }, [companyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return setError(t.deptErrNameRequired);
    setLoading(true);
    try {
      if (dept) {
// -------------------------------------------------------------------------
        const { data: updatedDept, error: err } = await supabase
          .from('departments')
          .update({ name, manager_id: managerId || null })
          .eq('id', dept.id)
          .select()
          .single();
        if (err) throw err;

        // If manager changed: remove old manager's department link if they're not in this dept
        if (dept.manager_id && dept.manager_id !== managerId) {
          await supabase
            .from('employees')
            .update({ department_id: null })
            .eq('id', dept.manager_id)
            .eq('department_id', dept.id); // only remove if they were in this dept via manager
        }

        // Link new manager to this department
        if (managerId) {
          const { error: empErr } = await supabase
            .from('employees')
            .update({ department_id: updatedDept.id })
            .eq('id', managerId);
          if (empErr) console.warn('[Departments] Could not link manager to dept:', empErr.message);
        }
      } else {
// -------------------------------------------------------------------------
        const { data: newDept, error: err } = await supabase
          .from('departments')
          .insert({ name, manager_id: managerId || null, company_id: companyId })
          .select()
          .single();
        if (err) throw err;

        // Link the chosen manager to the new department
        if (managerId && newDept) {
          const { error: empErr } = await supabase
            .from('employees')
            .update({ department_id: newDept.id })
            .eq('id', managerId);
          if (empErr) console.warn('[Departments] Could not link manager to dept:', empErr.message);
        }
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dept-modal-overlay" onClick={onClose}>
      <div className="dept-modal" onClick={e => e.stopPropagation()}>
        <div className="dept-modal-header">
          <h2>{dept ? t.deptModalEditTitle : t.deptModalAddTitle}</h2>
          <button onClick={onClose} className="dept-close-btn"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="dept-modal-content">
          {error && <div className="dept-error">{error}</div>}
          <div className="dept-field">
            <label>{t.deptNameLabel}</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder={t.deptNamePlaceholder}
              autoFocus
            />
          </div>
          <div className="dept-field">
            <label>{t.deptManagerSelectLabel}</label>
            <select value={managerId || ''} onChange={e => setManagerId(e.target.value)}>
              <option value="">{t.deptManagerSelectPlaceholder}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div className="dept-modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">{t.cancelBtn}</button>
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? t.deptSavingBtn : t.deptSaveBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
export default function Departments() {
  const { company } = useAuth();
  const { t } = useLocale();
  const [departments, setDepartments] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState({ open: false, dept: null });

  const fetchData = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      // Fetch departments
      const { data: depts, error: dErr } = await supabase
        .from('departments')
        .select('*, manager:employees(name)')
        .eq('company_id', company.id)
        .order('name');
      
      if (dErr) throw dErr;

      // Fetch employee counts per dept
      const { data: staff, error: sErr } = await supabase
        .from('employees')
        .select('id, name, department_id')
        .eq('company_id', company.id);
      
      if (sErr) throw sErr;

      const tally = {};
      staff.forEach(s => {
        if (s.department_id) tally[s.department_id] = (tally[s.department_id] || 0) + 1;
      });

      const enrichedDepts = (depts || []).map(d => ({
        ...d,
        manager_name: staff?.find(s => s.id === d.manager_id)?.name || d.manager?.name
      }));

      setDepartments(enrichedDepts);
      setCounts(tally);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = departments.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dept-page">
      <div className="dept-header">
        <div className="dept-title-group">
          <h1>{t.deptPageTitle}</h1>
          <p>{t.deptPageSubtitle}</p>
        </div>
        <button className="btn-add-dept" onClick={() => setModalState({ open: true, dept: null })}>
          <Plus size={20} />
          {t.deptAddBtn}
        </button>
      </div>

      <div className="dept-controls">
        <div className="dept-search-wrapper">
          <Search size={18} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder={t.deptSearchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="dept-stats-summary">
          <span>{t.deptTotalLabel} <strong>{departments.length}</strong></span>
        </div>
      </div>

      {loading ? (
        <div className="dept-loading-state">
          <div className="dept-spinner"></div>
          <p>{t.deptLoadingState}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="dept-empty-state">
          <Layers size={48} color="var(--border-color)" />
          <h3>{t.deptEmptyTitle}</h3>
          <p>{t.deptEmptyDesc}</p>
        </div>
      ) : (
        <div className="dept-grid">
          {filtered.map(dept => {
            const DeptIcon = getDepartmentIcon(dept.name);
            return (
              <div key={dept.id} className="dept-card" onClick={() => setModalState({ open: true, dept })}>
                <div className="dept-card-icon">
                  <DeptIcon size={24} color="var(--primary-color)" />
                </div>
                <div className="dept-card-body">
                  <h3 className="dept-card-name">{dept.name}</h3>
                  <div className="dept-card-meta">
                    <span className="meta-item">
                      <User size={14} />
                      {t.deptManagerLabel} {dept.manager_name || t.deptNoManager}
                    </span>
                    <span className="meta-item">
                      <Users size={14} />
                      {counts[dept.id] || 0} {t.deptEmployeeCount}
                    </span>
                  </div>
                </div>
                <div className="dept-card-action">
                  <ChevronDown size={18} color="var(--text-muted)" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalState.open && (
        <DepartmentModal 
          dept={modalState.dept} 
          companyId={company.id}
          t={t}
          onClose={() => setModalState({ open: false, dept: null })}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
