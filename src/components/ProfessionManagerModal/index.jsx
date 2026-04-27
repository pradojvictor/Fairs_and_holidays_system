// Arquivo: src/components/ProfessionManagerModal.jsx
import React, { useState } from 'react';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import './index.css';

export default function ProfessionManagerModal({ isOpen, onClose, professions = [], onDataUpdated }) {
  const [newProfession, setNewProfession] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  if (!isOpen) return null;

  const handleAddProfession = async (e) => {
    e.preventDefault();
    if (!newProfession.trim()) return; 
    setLoading(true);
    setFeedback({ type: '', message: '' }); 
    try {
      const currentData = await fetchGistData();
      const newCargo = { id: `cargo_${Date.now()}`, name: newProfession.trim() };
      currentData.professions = [...(currentData.professions || []), newCargo];
      
      await updateGistData(currentData);
      setNewProfession('');
      if (onDataUpdated) onDataUpdated();
      
      setFeedback({ type: 'success', message: 'Cargo salvo com sucesso!' });
      
      setTimeout(() => {
        setFeedback({ type: '', message: '' });
      }, 3000);
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao salvar o cargo.' });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="event-modal-overlay">
      <div className="event-modal-container modal-sm">  
        <div className="event-modal-header">
          <h3>Gerenciar Cargos</h3>
          <button onClick={onClose} className="btn-close-modal">&times;</button>
        </div>
        <form onSubmit={handleAddProfession} className="prof-manager-form">
          <input 
            type="text" 
            className="form-input" 
            placeholder="Ex: Enfermagem..." 
            value={newProfession} 
            onChange={(e) => setNewProfession(e.target.value)} 
            required 
            disabled={loading}
          />
          <button 
            type="submit" 
            className="btn-submit-event btn-add-prof" 
            disabled={loading}
          >
            {loading ? '⏳' : '+ Adicionar'}
          </button>
        </form>

        {feedback.message && (
          <div className={`feedback-toast-inline ${feedback.type}`}>
            {feedback.type === 'success' ? '✅ ' : '❌ '} {feedback.message}
          </div>
        )}
        <div className="prof-list-container-modal">
          <h4 className="prof-list-title">Cargos Cadastrados ({professions.length})</h4>
          <ul className="prof-list-ul">
            {professions.length === 0 ? (
              <li className="prof-list-empty">Nenhum cargo criado.</li>
            ) : (
              professions.map(p => (
                <li key={p.id} className="prof-list-item">
                  {p.name}
                </li>
              ))
            )}
          </ul>
        </div>

      </div>
    </div>
  );
}