// Arquivo: src/components/ConfirmModal.jsx
import React from 'react';
import './index.css';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, isLoading }) {
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay">
      <div className="confirm-modal-container">
        
        <div className="confirm-icon">⚠️</div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        
        <div className="confirm-actions">
          <button 
            className="btn-cancel-confirm" 
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </button>
          
          <button 
            className="btn-danger-confirm" 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Excluindo...' : 'Sim, Excluir'}
          </button>
        </div>

      </div>
    </div>
  );
}