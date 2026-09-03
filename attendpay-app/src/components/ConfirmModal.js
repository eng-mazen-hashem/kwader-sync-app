import React from 'react';
import { HiX } from 'react-icons/hi';
import { useLocale } from '../context/LocaleContext';

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, intent = 'danger' }) {
    const { t } = useLocale();

    if (!isOpen) return null;

    const intentColor = intent === 'danger' ? 'var(--color-danger)' : 'var(--accent-color)';

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ color: intentColor }}>{title || t.confirmTitle || 'تأكيد'}</h3>
                    <button className="modal-close" onClick={onClose}>
                        <HiX />
                    </button>
                </div>
                <div style={{ padding: '0 0 20px 0', color: 'var(--text-secondary)' }}>
                    {message}
                </div>
                <div className="modal-footer">
                    <button 
                        className={`btn btn-${intent === 'danger' ? 'danger' : 'primary'}`} 
                        onClick={onConfirm}
                    >
                        {confirmText || t.confirmBtn || 'نعم'}
                    </button>
                    <button className="btn btn-secondary" onClick={onClose}>
                        {cancelText || t.cancelBtn || 'إلغاء'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmModal;
