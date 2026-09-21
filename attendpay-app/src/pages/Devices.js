import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    HiOutlineDesktopComputer, HiOutlinePlus, HiOutlineRefresh,
    HiOutlinePencil, HiOutlineTrash
} from 'react-icons/hi';
import Modal from '../components/Modal';
import { supabase } from '../supabaseClient';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { CONFIG } from '../constants/config';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLogger';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLocale } from '../context/LocaleContext';
import './Devices.css';

function Devices() {
    const { company } = useAuth();
    const { t, language } = useLocale();
    const [deviceList, setDeviceList] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editDeviceId, setEditDeviceId] = useState(null);
    const [deviceToDelete, setDeviceToDelete] = useState(null);

    // Sync Agent dynamic download URL and version
    const [agentVersion, setAgentVersion] = useState(CONFIG.SYNC_AGENT_VERSION);
    const [agentDownloadUrl, setAgentDownloadUrl] = useState(CONFIG.SYNC_AGENT_DOWNLOAD_URL);

    const localDeviceSchema = useMemo(() => {
        return z.object({
            device_name: z.string().min(1, t.dev_err_name || (language === 'en' ? 'Device name is required' : 'اسم الجهاز مطلوب')),
            serial_number: z.string().min(1, t.dev_err_serial || (language === 'en' ? 'Serial number is required' : 'الرقم التسلسلي مطلوب')),
            ip_address: z.string().optional().or(z.literal('')),
            port: z.string().default('4370'),
        });
    }, [t, language]);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(localDeviceSchema),
        defaultValues: { device_name: '', serial_number: '', ip_address: '', port: '4370' }
    });

    const fetchDevices = useCallback(async () => {
        if (!company) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('devices')
                .select('id, device_name, serial_number, ip_address, port, status, last_sync, created_at')
                .eq('company_id', company.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setDeviceList(data || []);
        } catch (e) {
            console.error('[fetchDevices]', e);
            toast.error(t.dev_toast_fetch_error || 'تعذر جلب الأجهزة');
        } finally {
            setLoading(false);
        }
    }, [company, t]);

    const fetchAgentSettings = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('key, value')
                .in('key', ['sync_agent_version', 'sync_agent_download_url']);
            if (!error && data) {
                data.forEach(item => {
                    if (item.key === 'sync_agent_version' && item.value) setAgentVersion(item.value);
                    if (item.key === 'sync_agent_download_url' && item.value) setAgentDownloadUrl(item.value);
                });
            }
        } catch (err) {
            console.error("Failed to load agent settings:", err);
        }
    }, []);

    useEffect(() => {
        fetchDevices();
        fetchAgentSettings();
    }, [fetchDevices, fetchAgentSettings]);



    const handleSubmitDevice = async (formData) => {
        if (!company) return;

        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();

            if (isEditing) {
                const { error } = await supabase
                    .from('devices')
                    .update({
                        device_name: formData.device_name,
                        serial_number: formData.serial_number,
                        ip_address: formData.ip_address || null,
                        port: parseInt(formData.port) || 4370,
                    })
                    .eq('id', editDeviceId)
                    .eq('company_id', company.id);

                if (error) throw error;
                toast.success(t.dev_toast_save_success || 'تم تحديث الجهاز بنجاح ✅');
                await logAudit({
                    companyId: company.id,
                    userId: authUser?.id,
                    action: 'UPDATE_DEVICE',
                    tableName: 'devices',
                    recordId: editDeviceId,
                    oldData: deviceList.find(d => d.id === editDeviceId),
                    newData: formData,
                });
            } else {
                const maxDev = company.limits?.max_devices || company.max_devices || 1;
                if (deviceList.length >= maxDev) {
                    toast.error(
                        language === 'ar'
                            ? `لقد بلغت الحد الأقصى لأجهزة البصمة المسموح بها في باقتك (${maxDev} جهاز). يرجى ترقية الباقة لربط أجهزة إضافية.`
                            : `You have reached the maximum allowed biometric devices for your plan (${maxDev} devices). Please upgrade your plan.`
                    );
                    return;
                }

                const { data: inserted, error } = await supabase
                    .from('devices')
                    .insert({
                        company_id: company.id,
                        device_name: formData.device_name,
                        serial_number: formData.serial_number,
                        ip_address: formData.ip_address || null,
                        port: parseInt(formData.port) || 4370,
                    })
                    .select('id')
                    .single();

                if (error) throw error;
                toast.success(t.dev_toast_save_success || 'تم إضافة الجهاز بنجاح ✅');
                await logAudit({
                    companyId: company.id,
                    userId: authUser?.id,
                    action: 'ADD_DEVICE',
                    tableName: 'devices',
                    recordId: inserted?.id,
                    oldData: null,
                    newData: formData,
                });
            }

            setShowModal(false);
            setIsEditing(false);
            setEditDeviceId(null);
            reset({ device_name: '', serial_number: '', ip_address: '', port: '4370' });
            fetchDevices();
        } catch (error) {
            console.error('[Devices] handleSubmitDevice:', error.message);
            toast.error(t.dev_toast_save_error || 'حدث خطأ أثناء حفظ الجهاز');
        }
    };

    const handleEditClick = (device) => {
        reset({
            device_name: device.device_name,
            serial_number: device.serial_number,
            ip_address: device.ip_address || '',
            port: device.port?.toString() || '4370'
        });
        setEditDeviceId(device.id);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDeleteDevice = (id) => {
        setDeviceToDelete(id);
    };

    const confirmDeleteDevice = async () => {
        if (!deviceToDelete) return;
        try {
            const deviceObj = deviceList.find(d => d.id === deviceToDelete);

            const { error } = await supabase
                .from('devices')
                .delete()
                .eq('id', deviceToDelete)
                .eq('company_id', company.id); // دفاع ثانٍ ضد حذف سجلات لشركة أخرى

            if (error) throw error;

            toast.success(t.dev_toast_delete_success || 'تم حذف الجهاز بنجاح');

            const { data: { user: authUser } } = await supabase.auth.getUser();
            await logAudit({
                companyId: company.id,
                userId: authUser?.id,
                action: 'DELETE_DEVICE',
                tableName: 'devices',
                recordId: deviceToDelete,
                oldData: deviceObj || null,
                newData: null,
            });

            fetchDevices();
        } catch (error) {
            console.error('[Devices] confirmDeleteDevice:', error.message);
            toast.error(t.dev_toast_delete_error || 'تعذر حذف الجهاز');
        } finally {
            setDeviceToDelete(null);
        }
    };

    const formatLastSync = (dateStr) => {
        if (!dateStr) return t.dev_never_synced || 'لم تتم المزامنة';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 5) return t.dev_just_now || 'الآن';
        if (diffMins < 60) return t.dev_mins_ago?.replace('{count}', diffMins) || `منذ ${diffMins} دقيقة`;
        if (diffMins < 1440) return t.dev_hours_ago?.replace('{count}', Math.floor(diffMins / 60)) || `منذ ${Math.floor(diffMins / 60)} ساعة`;
        return t.dev_days_ago?.replace('{count}', Math.floor(diffMins / 1440)) || `منذ ${Math.floor(diffMins / 1440)} يوم`;
    };

    return (
        <div className="devices-luxe-container">
            <div className="devices-header">
                <div>
                    <h1 className="devices-title">{t.dev_page_title || 'إدارة الأجهزة'}</h1>
                    <p className="devices-subtitle">{t.dev_page_subtitle || 'أجهزة البصمة المتصلة بالنظام والمزامنة المباشرة'}</p>
                </div>
                <div className="devices-header-stats">
                    <div className="device-stat-box">
                        <div className="stat-icon-wrapper secondary">
                            <HiOutlineDesktopComputer size={24} />
                        </div>
                        <div className="stat-details">
                            <p className="stat-label">{t.dev_active_devices || 'الأجهزة النشطة'}</p>
                            <p className="stat-value" style={{ direction: 'ltr' }}>{deviceList.filter(d => d.status === 'connected').length} / {deviceList.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="devices-grid">
                {loading ? (
                    <div className="devices-empty-state">{t.loading || 'جاري التحميل...'}</div>
                ) : (
                    <>
                        {deviceList.map((device) => (
                            <div className="device-card" key={device.id}>
                                <div className="device-card-content">
                                    <div className="device-card-header">
                                        <div className="device-info-hero">
                                            <div className="device-icon-box">
                                                <HiOutlineDesktopComputer />
                                            </div>
                                            <div>
                                                <h3 className="device-name">{device.device_name}</h3>
                                                <span className="device-model">{t.dev_zk_biometric || 'ZKTeco Biometric'}</span>
                                            </div>
                                        </div>
                                        <div className={`device-status-badge ${device.status === 'connected' ? 'online' : 'offline'}`}>
                                            <span className="status-dot">
                                                {device.status === 'connected' && <span className="status-dot-ping"></span>}
                                                <span className="status-dot-core"></span>
                                            </span>
                                            <span>{device.status === 'connected' ? (t.dev_status_online || 'ONLINE') : (t.dev_status_offline || 'OFFLINE')}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="device-actions-row">
                                        <button className="device-action-btn" title={t.editTitle || 'تعديل'} onClick={() => handleEditClick(device)}>
                                            <HiOutlinePencil size={16} />
                                        </button>
                                        <button className="device-action-btn danger" title={t.deleteTitle || 'حذف'} onClick={() => handleDeleteDevice(device.id)}>
                                            <HiOutlineTrash size={16} />
                                        </button>
                                    </div>

                                    <div className="device-details-list">
                                        <div className={`device-detail-item ${device.status !== 'connected' ? 'offline-state' : ''}`}>
                                            <span className="device-detail-label">{t.dev_ip_address || 'IP Address'}</span>
                                            <span className="device-detail-value">{device.ip_address ? `${device.ip_address}:${device.port}` : 'N/A'}</span>
                                        </div>
                                        <div className={`device-detail-item ${device.status !== 'connected' ? 'offline-state' : ''}`}>
                                            <span className="device-detail-label">{t.dev_serial_number || 'Serial Number'}</span>
                                            <span className="device-detail-value" style={{ direction: 'ltr' }}>SN: {device.serial_number}</span>
                                        </div>
                                        <div className="device-detail-item">
                                            <span className="device-detail-label">{t.dev_last_sync || 'Last Sync Time'}</span>
                                            <span className={`device-detail-value ${device.status !== 'connected' ? 'offline-alert' : ''}`}>
                                                {formatLastSync(device.last_sync)}
                                            </span>
                                        </div>
                                    </div>

                                    <button className={`device-sync-btn ${device.status !== 'connected' ? 'offline-mode' : ''}`}>
                                        <HiOutlineRefresh />
                                        {device.status === 'connected' ? (t.dev_sync_now || 'Sync Now') : (t.dev_troubleshoot || 'Troubleshoot')}
                                    </button>
                                </div>
                                <div className="device-card-glow"></div>
                            </div>
                        ))}

                        {/* Insight Bento and Sync Agent */}
                        <div className="device-insight-bento">
                            <div className="insight-content">
                                <div className="insight-badge">
                                    <HiOutlineDesktopComputer size={16} />
                                    <span>Sync Agent {agentVersion}</span>
                                </div>
                                <h2 className="insight-title">{t.dev_sync_agent_title || 'أداة المزامنة الذكية'}</h2>
                                <p className="insight-desc">
                                    {t.dev_sync_agent_desc || 'لربط أجهزة البصمة المحلية بالمنصة السحابية، يجب تثبيت أداة المزامنة على أي جهاز كمبيوتر (Windows 10/11) متصل بنفس شبكة أجهزة البصمة. تدعم جميع أجهزة ZKTeco.'}
                                </p>
                                <a href={agentDownloadUrl} download="KWADER_Sync_Setup_v1.2.0.exe" className="insight-button">
                                    <HiOutlineDesktopComputer size={20} />
                                    {t.dev_download_agent || 'تحميل الأداة'}
                                </a>
                            </div>
                            <div className="insight-visual">
                                <div className="visual-value">99.9<span>%</span></div>
                                <div className="visual-label">Uptime Reliability</div>
                            </div>
                        </div>

                        {/* Add Device CTA */}
                        <div className="device-add-cta" onClick={() => {
                            const maxDev = company?.limits?.max_devices || company?.max_devices || 1;
                            if (deviceList.length >= maxDev) {
                                toast.error(
                                    language === 'ar'
                                        ? `لقد بلغت الحد الأقصى لأجهزة البصمة في باقتك (${maxDev} جهاز). يرجى الترقية لإضافة أجهزة إضافية.`
                                        : `You have reached the maximum allowed biometric devices for your plan (${maxDev} devices). Please upgrade your plan.`
                                );
                                return;
                            }
                            reset({ device_name: '', serial_number: '', ip_address: '', port: '4370' });
                            setIsEditing(false);
                            setShowModal(true);
                        }}>
                            <div className="add-cta-icon">
                                <HiOutlinePlus />
                            </div>
                            <h3 className="add-cta-title">{t.dev_add_device || 'إضافة جهاز جديد'}</h3>
                            <p className="add-cta-desc">Integrate new hardware node into the network</p>
                        </div>
                    </>
                )}
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setIsEditing(false);
                }}
                title={isEditing ? (t.dev_edit_device || "تعديل بيانات الجهاز") : (t.dev_add_device || "إضافة جهاز جديد")}
            >
                <form onSubmit={handleSubmit(handleSubmitDevice)}>
                    <div className="form-group">
                        <label className="form-label">{t.dev_device_name || 'اسم الجهاز'}</label>
                        <input className={`form-input ${errors.device_name ? 'error' : ''}`} type="text" placeholder={t.dev_device_name_placeholder || 'مثال: جهاز البوابة الرئيسية'}
                            {...register('device_name')} />
                        {errors.device_name && <p className="error-text">{errors.device_name.message}</p>}
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t.dev_serial_number || 'الرقم التسلسلي'}</label>
                        <input className={`form-input ${errors.serial_number ? 'error' : ''}`} type="text" placeholder={t.dev_serial_placeholder || 'مثال: ZK-2024-001'} dir="ltr"
                            {...register('serial_number')} />
                        {errors.serial_number && <p className="error-text">{errors.serial_number.message}</p>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">{(t.dev_ip_address || 'عنوان IP')} {language === 'en' ? '(optional)' : '(اختياري)'}</label>
                            <input className="form-input" type="text" placeholder={t.dev_ip_placeholder || '192.168.1.100'} dir="ltr"
                                {...register('ip_address')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t.dev_port || 'المنفذ'}</label>
                            <input className="form-input" type="number" placeholder="4370" dir="ltr"
                                {...register('port')} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (t.saving || "جاري الحفظ...") : (isEditing ? (t.saveChangesBtn || "حفظ التغييرات") : (t.dev_add_device || "إضافة الجهاز"))}
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)}>{t.cancelBtn || 'إلغاء'}</button>
                    </div>
                </form>
            </Modal>
            <ConfirmModal
                isOpen={!!deviceToDelete}
                onClose={() => setDeviceToDelete(null)}
                onConfirm={confirmDeleteDevice}
                title={t.dev_delete_confirm_title || "تأكيد حذف الجهاز"}
                message={t.dev_delete_confirm_msg || "هل أنت متأكد من حذف هذا الجهاز؟ سيتوقف عن العمل في النظام وسيتم فصله عن أداة المزامنة ولا يمكن التراجع عن هذا الإجراء."}
                confirmText={t.dev_delete_btn || "حذف الجهاز"}
            />
        </div>
    );
}

export default Devices;
