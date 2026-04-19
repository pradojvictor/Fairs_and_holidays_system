// Arquivo: src/components/EventModal.jsx
import { useEffect, useState } from 'react';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import './index.css';

export default function EventModal({ isOpen, onClose, professionals = [], events = [], onDataUpdated, eventToEdit }) {
  const [profId, setProfId] = useState('');
  const [type, setType] = useState('ferias');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [conflictWarning, setConflictWarning] = useState(null); // Estado para o alerta amarelo

  useEffect(() => {
    if (eventToEdit) {
      setProfId(eventToEdit.professionalId);
      setType(eventToEdit.type);
      setReason(eventToEdit.reason || '');
      setStartDate(eventToEdit.startDate);
      setEndDate(eventToEdit.endDate);
    } else {
      setProfId('');
      setType('ferias');
      setReason('');
      setStartDate('');
      setEndDate('');
    }
    setConflictWarning(null);
    setErrorMsg('');
  }, [eventToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e, forceSave = false) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!profId) { setErrorMsg('Selecione um profissional.'); return; }
    if (startDate > endDate) { setErrorMsg('A data final não pode ser antes da inicial.'); return; }

    // 1. VERIFICAÇÃO RÍGIDA: Mesma pessoa (Erro Vermelho)
    const hasPersonalConflict = events.some(existingEvent => {
      if (existingEvent.professionalId !== profId) return false;
      if (eventToEdit && existingEvent.id === eventToEdit.id) return false;
      return (startDate <= existingEvent.endDate) && (endDate >= existingEvent.startDate);
    });

    if (hasPersonalConflict) {
      setErrorMsg('Atenção: Este funcionário já possui uma ausência marcada neste período!');
      return; 
    }

    // 2. VERIFICAÇÃO DE CARGO: Setor Descoberto (Aviso Amarelo)
    if (!forceSave) {
      const currentPro = professionals.find(p => String(p.id) === String(profId));
      const currentCargoId = currentPro?.professionId;

      if (currentCargoId) {
        const conflictingEvent = events.find(ev => {
          if (eventToEdit && ev.id === eventToEdit.id) return false;
          if (String(ev.professionalId) === String(profId)) return false; 
          
          const isOverlapping = (startDate <= ev.endDate) && (endDate >= ev.startDate);

          if (isOverlapping) {
             const otherPro = professionals.find(p => String(p.id) === String(ev.professionalId));
             return otherPro?.professionId === currentCargoId;
          }
          return false;
        });

        if (conflictingEvent) {
           const outroPro = professionals.find(p => String(p.id) === String(conflictingEvent.professionalId));
           setConflictWarning(`Aviso: ${outroPro.name} (mesmo cargo) já possui ${conflictingEvent.type} neste período. Deseja confirmar mesmo assim?`);
           return; 
        }
      }
    }

    setConflictWarning(null);
    setLoading(true);

    try {
      const currentData = await fetchGistData();
      
      const savedEvent = {
        id: eventToEdit ? eventToEdit.id : `evt_${Date.now()}`,
        professionalId: profId,
        type: type,
        reason: type === 'folga' ? reason.trim() : '',
        startDate: startDate,
        endDate: endDate
      };

      if (eventToEdit) {
        currentData.events = currentData.events.map(e => e.id === eventToEdit.id ? savedEvent : e);
      } else {
        currentData.events = [...(currentData.events || []), savedEvent];
      }

      await updateGistData(currentData);
      if (onDataUpdated) onDataUpdated();
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
          <h3>{eventToEdit ? 'Editar Ausência' : 'Nova Ausência'}</h3>
          <button onClick={onClose} className="btn-close-modal">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ... Seus campos Select, Type Selector, Reason Input e Date Row continuam iguais ... */}
          
          <div className="form-group">
            <label>Profissional</label>
            <select className="form-select" value={profId} onChange={(e) => setProfId(e.target.value)}>
              <option value="">-- Selecione o funcionário --</option>
              {professionals.map(pro => <option key={pro.id} value={pro.id}>{pro.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Tipo de Ausência</label>
            <div className="type-selector">
              <div className={`type-option ferias ${type === 'ferias' ? 'active' : ''}`} onClick={() => setType('ferias')}>Férias</div>
              <div className={`type-option folga ${type === 'folga' ? 'active' : ''}`} onClick={() => setType('folga')}>Folga</div>
            </div>
          </div>

          {type === 'folga' && (
            <div className="form-group">
              <label>Motivo da Folga (Opcional)</label>
              <input type="text" className="form-input" placeholder="Ex: Consulta médica..." value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}

          <div className="date-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Data de Início</label>
              <input type="date" className="form-input" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Data de Retorno</label>
              <input type="date" className="form-input" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {errorMsg && <p className="error-msg-modal">{errorMsg}</p>}

          {/* CAIXA DE AVISO AMARELA */}
          {conflictWarning && (
            <div className="conflict-warning-box">
              <p>⚠️ {conflictWarning}</p>
              <div className="conflict-actions">
                <button type="button" onClick={() => handleSubmit(null, true)} className="btn-force-save">Salvar mesmo assim</button>
                <button type="button" onClick={() => setConflictWarning(null)} className="btn-cancel-warning">Revisar</button>
              </div>
            </div>
          )}

          {!conflictWarning && (
            <button type="submit" className="btn-submit-event" disabled={loading}>
              {loading ? 'Salvando...' : (eventToEdit ? 'Atualizar Agendamento' : 'Confirmar Agendamento')}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}