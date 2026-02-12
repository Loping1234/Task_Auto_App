import React, { useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const getIcon = (type) => {
        const iconMap = {
            chat: 'fa-comment',
            task_edit: 'fa-edit',
            team_change: 'fa-users',
            status_change: 'fa-sync-alt',
            assignment: 'fa-tasks'
        };
        return iconMap[type] || 'fa-info-circle';
    };

    return (
        <div className={`notification-toast ${type}`} onClick={onClose}>
            <div className="toast-icon">
                <i className={`fas ${getIcon(type)}`}></i>
            </div>
            <div className="toast-content">
                <p>{message}</p>
            </div>
            <button className="toast-close">
                <i className="fas fa-times"></i>
            </button>
        </div>
    );
};

export default Toast;
