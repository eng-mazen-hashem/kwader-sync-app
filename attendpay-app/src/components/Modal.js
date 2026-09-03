import React from 'react';
import { HiX } from 'react-icons/hi';

function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button className="modal-close" onClick={onClose}>
                        <HiX />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export default Modal;
