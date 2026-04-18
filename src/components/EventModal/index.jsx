// Arquivo: src/components/EventModal.jsx
import { useState } from 'react';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import './index.css';

export default function EventModal({ isOpen, onClose, professionals, onDataUpdated }) {
  // Estados do formulário
  const [profId, setProfId] = useState('');
  const [type, setType] = useState('ferias'); // 'ferias' ou 'folga'
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null; // Se não estiver aberto, não renderiza nada

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Validação básica
    if (!profId) {
      setErrorMsg('Selecione um profissional.');
      return;
    }
    if (startDate > endDate) {
      setErrorMsg('A data final não pode ser antes da inicial.');
      return;
    }

    setLoading(true);

    try {
      const currentData = await fetchGistData();
      
      const newEvent = {
        id: `evt_${Date.now()}`,
        professionalId: profId,
        type: type,
        reason: type === 'folga' ? reason.trim() : '', // Só salva motivo se for folga
        startDate: startDate,
        endDate: endDate
      };

      currentData.events = [...(currentData.events || []), newEvent];
      await updateGistData(currentData);

      if (onDataUpdated) onDataUpdated(); // Atualiza o dashboard
      
      // Limpa os campos e fecha o modal
      setProfId('');
      setType('ferias');
      setReason('');
      setStartDate('');
      setEndDate('');
      onClose();

    } catch (error) {
      console.error(error);
      setErrorMsg('Erro ao salvar o agendamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="event-modal-overlay">
      <div className="event-modal-container">
        
        <div className="event-modal-header">
          <h3>Nova Ausência</h3>
          <button onClick={onClose} className="btn-close-modal">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          
          <div className="form-group">
            <label>Profissional</label>
            <select 
              className="form-select" 
              value={profId} 
              onChange={(e) => setProfId(e.target.value)}
            >
              <option value="">-- Selecione o funcionário --</option>
              {professionals.map(pro => (
                <option key={pro.id} value={pro.id}>{pro.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Tipo de Ausência</label>
            <div className="type-selector">
              <div 
                className={`type-option ferias ${type === 'ferias' ? 'active' : ''}`}
                onClick={() => setType('ferias')}
              >
                Férias
              </div>
              <div 
                className={`type-option folga ${type === 'folga' ? 'active' : ''}`}
                onClick={() => setType('folga')}
              >
                Folga
              </div>
            </div>
          </div>

          {/* O campo de motivo só aparece se for FOLGA */}
          {type === 'folga' && (
            <div className="form-group">
              <label>Motivo da Folga (Opcional)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ex: Consulta médica, Banco de horas..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}

          <div className="date-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Data de Início</label>
              <input 
                type="date" 
                className="form-input" 
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Data de Retorno (Fim)</label>
              <input 
                type="date" 
                className="form-input" 
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {errorMsg && <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', margin: '0.5rem 0' }}>{errorMsg}</p>}

          <button type="submit" className="btn-submit-event" disabled={loading}>
            {loading ? 'Lançando...' : 'Confirmar Agendamento'}
          </button>

        </form>
      </div>
    </div>
  );
}