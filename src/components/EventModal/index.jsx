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

  // A MÁGICA: Preenche o form se for modo de edição, ou limpa se for novo evento
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
  }, [eventToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!profId) { setErrorMsg('Selecione um profissional.'); return; }
    if (startDate > endDate) { setErrorMsg('A data final não pode ser antes da inicial.'); return; }

    // --- NOVA INTELIGÊNCIA: VERIFICAÇÃO DE CONFLITO ---
    const hasConflict = events.some(existingEvent => {
      // 1. Só verifica os eventos do MESMO funcionário que selecionamos
      if (existingEvent.professionalId !== profId) return false;

      // 2. Se estamos EDITANDO, o código deve ignorar o próprio evento na checagem
      if (eventToEdit && existingEvent.id === eventToEdit.id) return false;

      // 3. A matemática da Colisão: 
      // Se o Novo INÍCIO encosta ou vem antes do Antigo FIM
      // E o Novo FIM encosta ou vem depois do Antigo INÍCIO = CONFLITO!
      return (startDate <= existingEvent.endDate) && (endDate >= existingEvent.startDate);
    });

    if (hasConflict) {
      setErrorMsg('Atenção: Este funcionário já possui uma ausência marcada neste período!');
      return; // O return para a execução e impede de salvar no Gist
    }
    // --- FIM DA VERIFICAÇÃO ---

    setLoading(true);

    try {
      const currentData = await fetchGistData();
      
      const savedEvent = {
        id: eventToEdit ? eventToEdit.id : `evt_${Date.now()}`, // Mantém a ID se for edição
        professionalId: profId,
        type: type,
        reason: type === 'folga' ? reason.trim() : '',
        startDate: startDate,
        endDate: endDate
      };

      if (eventToEdit) {
        // MODO EDIÇÃO: Substitui o antigo
        currentData.events = currentData.events.map(e => e.id === eventToEdit.id ? savedEvent : e);
      } else {
        // MODO CRIAÇÃO: Adiciona na lista
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
          {/* Título muda de acordo com o modo */}
          <h3>{eventToEdit ? 'Editar Ausência' : 'Nova Ausência'}</h3>
          <button onClick={onClose} className="btn-close-modal">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
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
              <input type="text" className="form-input" placeholder="Ex: Consulta médica, Banco de horas..." value={reason} onChange={(e) => setReason(e.target.value)} />
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

          {errorMsg && <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', margin: '0.5rem 0' }}>{errorMsg}</p>}

          <button type="submit" className="btn-submit-event" disabled={loading}>
            {loading ? 'Salvando...' : (eventToEdit ? 'Atualizar Agendamento' : 'Confirmar Agendamento')}
          </button>
        </form>
      </div>
    </div>
  );
}