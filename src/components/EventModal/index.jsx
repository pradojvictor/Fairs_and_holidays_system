// Arquivo: src/components/EventModal.jsx
import { useEffect, useState } from 'react';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import CustomSelect from '../CustomSelect';
import './index.css';

export default function EventModal({ isOpen, onClose, professionals = [], events = [], onDataUpdated, eventToEdit }) {
  const [profId, setProfId] = useState('');
  const [type, setType] = useState('ferias');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLoteYear, setSelectedLoteYear] = useState('');
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(null);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const showFeedback = (type, message, duration = 4000) => {
    setFeedback({ type, message });
    if (duration) {
      setTimeout(() => setFeedback({ type: '', message: '' }), duration);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setCalculatedDays(startDate > endDate ? 0 : diffDays);
    } else {
      setCalculatedDays(0);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (eventToEdit) {
      setProfId(eventToEdit.professionalId);
      setType(eventToEdit.type);
      setStartDate(eventToEdit.startDate);
      setEndDate(eventToEdit.endDate);
      setSelectedLoteYear(eventToEdit.loteYear || '');
      setReason(eventToEdit.reason || '');
    } else {
      setProfId('');
      setType('ferias');
      setStartDate('');
      setEndDate('');
      setSelectedLoteYear('');
      setReason('');
    }
    setConflictWarning(null);
    setFeedback({ type: '', message: '' });
  }, [eventToEdit, isOpen]);

  if (!isOpen) return null;

  const currentPro = professionals.find(p => String(p.id) === String(profId));

  const getSaldosFerias = (pro) => {
    if (!pro?.bancoFerias || !Array.isArray(pro.bancoFerias)) return {};
    const saldos = {};
    pro.bancoFerias.forEach(log => {
      if (!saldos[log.year]) saldos[log.year] = { year: log.year, category: log.category, days: 0 };
      if (log.type === 'entrada' || !log.type) saldos[log.year].days += log.days;
      else if (log.type === 'saida') saldos[log.year].days -= log.days;
    });
    return saldos;
  };

  const getSaldoFolgas = (pro) => {
    if (!pro?.bancoFolgas || !Array.isArray(pro.bancoFolgas)) return 0;
    return pro.bancoFolgas.reduce((acc, log) => log.type === 'entrada' ? acc + log.days : acc - log.days, 0);
  };

  const saldosAtuais = currentPro ? getSaldosFerias(currentPro) : {};
  const saldoFolgasAtual = currentPro ? getSaldoFolgas(currentPro) : 0;

  let isSaldoInsuficiente = false;
  let mensagemSaldo = '';

  if (profId && calculatedDays > 0 && type !== 'atestado') {
    if (type === 'ferias') {
      if (!selectedLoteYear) {
        isSaldoInsuficiente = true;
        mensagemSaldo = 'Selecione um lote de férias abaixo.';
      } else {
        const saldoDoLote = saldosAtuais[selectedLoteYear]?.days || 0;

        let saldoReal = saldoDoLote;
        if (eventToEdit && eventToEdit.type === 'ferias' && eventToEdit.loteYear === selectedLoteYear) {
          const startE = new Date(eventToEdit.startDate);
          const endE = new Date(eventToEdit.endDate);
          const diffOriginal = Math.ceil(Math.abs(endE - startE) / (1000 * 60 * 60 * 24)) + 1;
          saldoReal += diffOriginal;
        }

        if (calculatedDays > saldoReal) {
          isSaldoInsuficiente = true;
          mensagemSaldo = `SALDO INSUFICIENTE: O lote ${selectedLoteYear} tem apenas ${saldoReal} dia(s). Reduza o período ou escolha outro lote. (Não misture lotes!)`;
        }
      }
    } else if (type === 'folga') {
      let saldoReal = saldoFolgasAtual;
      if (eventToEdit && eventToEdit.type === 'folga') {
        const startE = new Date(eventToEdit.startDate);
        const endE = new Date(eventToEdit.endDate);
        const diffOriginal = Math.ceil(Math.abs(endE - startE) / (1000 * 60 * 60 * 24)) + 1;
        saldoReal += diffOriginal;
      }
      if (calculatedDays > saldoReal) {
        isSaldoInsuficiente = true;
        mensagemSaldo = `SALDO INSUFICIENTE: O funcionário tem apenas ${saldoReal} folga(s) registrada(s).`;
      }
    }
  }

  const handleSubmit = async (e, forceSave = false) => {
    if (e) e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!profId) { showFeedback('error', 'Selecione um profissional.'); return; }
    if (startDate > endDate) { showFeedback('error', 'A data final não pode ser antes da inicial.'); return; }
    if (isSaldoInsuficiente) { showFeedback('error', mensagemSaldo); return; }

    if (type === 'atestado' && !reason.trim()) {
      showFeedback('error', 'Para lançar um atestado, o MOTIVO (CID, Médico, etc) é obrigatório.');
      return;
    }

    const hasPersonalConflict = events.some(existingEvent => {
      if (existingEvent.professionalId !== profId) return false;
      if (eventToEdit && existingEvent.id === eventToEdit.id) return false;
      return (startDate <= existingEvent.endDate) && (endDate >= existingEvent.startDate);
    });

    if (hasPersonalConflict) {
      showFeedback('error', 'Atenção: Este funcionário já possui uma ausência marcada neste período!');
      return;
    }

    if (!forceSave) {
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
      const eventId = eventToEdit ? eventToEdit.id : `evt_${Date.now()}`;

      const savedEvent = {
        id: eventId,
        professionalId: profId,
        type: type,
        reason: type === 'atestado' ? reason.trim() : '',
        startDate: startDate,
        endDate: endDate,
        loteYear: type === 'ferias' ? selectedLoteYear : null
      };

      if (eventToEdit) {
        currentData.events = currentData.events.map(e => e.id === eventToEdit.id ? savedEvent : e);
      } else {
        currentData.events = [...(currentData.events || []), savedEvent];
      }

      const updatedProfessionals = currentData.professionals.map(pro => {
        if (pro.id === profId && type !== 'atestado') {
          let updatedFolgas = Array.isArray(pro.bancoFolgas) ? [...pro.bancoFolgas] : [];
          let updatedFerias = Array.isArray(pro.bancoFerias) ? [...pro.bancoFerias] : [];

          const saidaFormatada = `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`;

          if (type === 'folga') {
            const logFolga = {
              id: `log_${eventId}`,
              type: 'saida',
              days: calculatedDays,
              reason: `Uso no período: ${saidaFormatada}`,
              createdAt: new Date().toLocaleDateString('pt-BR'),
              targetDate: saidaFormatada
            };
            updatedFolgas = updatedFolgas.filter(f => f.id !== `log_${eventId}`);
            updatedFolgas.push(logFolga);

          } else if (type === 'ferias') {
            const logFerias = {
              id: `log_${eventId}`,
              type: 'saida',
              year: selectedLoteYear,
              days: calculatedDays,
              createdAt: new Date().toLocaleDateString('pt-BR'),
              targetDate: saidaFormatada
            };
            updatedFerias = updatedFerias.filter(f => f.id !== `log_${eventId}`);
            updatedFerias.push(logFerias);
          }
          return { ...pro, bancoFolgas: updatedFolgas, bancoFerias: updatedFerias };
        }
        return pro;
      });

      currentData.professionals = updatedProfessionals;
      await updateGistData(currentData);
      if (onDataUpdated) onDataUpdated();

      showFeedback('success', type === 'atestado'
        ? 'Atestado salvo no histórico com sucesso!'
        : 'Ausência registrada e saldo atualizado!', 1500);

      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      console.error(error);
      showFeedback('error', 'Erro ao salvar o agendamento e o saldo.');
    } finally {
      setLoading(false);
    }
  };

  const sortedProfessionals = [...professionals].sort((a, b) => a.name.localeCompare(b.name));

  const lotesOptions = Object.values(saldosAtuais)
    .filter(saldo => saldo.days > 0 || (eventToEdit && eventToEdit.loteYear === saldo.year))
    .map(saldo => ({
      value: saldo.year,
      label: `${saldo.year} - Restam ${saldo.days} dias (${saldo.category})`
    }));

  return (
    <div className="event-modal-overlay">
      <div className="event-modal-container">
        <div className="event-modal-header">
          <h3>{eventToEdit ? 'Editar Ausência' : 'Nova Ausência'}</h3>
          <button onClick={onClose} className="btn-close-modal">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          {eventToEdit ? (
            <div className="form-group">
              <label>Profissional (Não editável)</label>
              <input type="text" className="sidebar-input" value={currentPro?.name || ''} disabled />
            </div>
          ) : (
            <CustomSelect
              label="Profissional"
              placeholder="-- Selecione o funcionário --"
              value={profId}
              onChange={setProfId}
              options={sortedProfessionals.map(pro => ({ value: pro.id, label: pro.name }))}
            />
          )}

          {profId && (
            <CustomSelect
              label="Tipo de Ausência"
              value={type}
              onChange={setType}
              options={[
                { value: 'ferias', label: 'Férias' },
                { value: 'folga', label: 'Folga' },
                { value: 'atestado', label: 'Atestado' }
              ]}
            />
          )}

          {profId && type === 'ferias' && (
            <div className="bank-card" style={{ padding: '1rem', marginBottom: '1.2rem' }}>
              <h4 style={{ color: 'orange', marginBottom: '0.8rem', fontSize: '0.9rem' }}>Lote de Férias a Descontar:</h4>
              {lotesOptions.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#ef4444', margin: 0 }}>Este funcionário não tem férias no banco.</p>
              ) : (
                <CustomSelect
                  value={selectedLoteYear}
                  onChange={setSelectedLoteYear}
                  placeholder="-- Selecione o Ano --"
                  options={lotesOptions}
                />
              )}
            </div>
          )}

          {profId && type === 'folga' && (
            <div className="bank-card" style={{ padding: '1rem', marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'white' }}>Saldo Total de Folgas:</span>
              <strong style={{ color: saldoFolgasAtual > 0 ? '#10b981' : '#ef4444', fontSize: '1.2rem' }}>{saldoFolgasAtual} dias</strong>
            </div>
          )}

          {profId && (
            <div className="date-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Data de Início</label>
                <input type="date" className="sidebar-input no-margin" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Data de Retorno</label>
                <input type="date" className="sidebar-input no-margin" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}

          {calculatedDays > 0 && (
            <div className="bank-card" style={{ textAlign: 'center', marginBottom: '1.2rem', padding: '1rem' }}>
              <span style={{ color: '#d1d5db', fontSize: '0.9rem' }}>
                Agendando {type !== 'atestado' && 'e descontando'}:
              </span> <strong style={{ color: 'orange', fontSize: '1.2rem' }}>{calculatedDays} dia(s)</strong>
            </div>
          )}

          {profId && type === 'atestado' && (
            <div className="form-group">
              <label>Motivo do Atestado (Obrigatório)</label>
              <input type="text" className="sidebar-input" required placeholder="Ex: Retorno Médico, CID J01..." value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}

          {feedback.message && (
            <div className={`feedback-toast ${feedback.type}`} style={{ marginBottom: '1rem' }}>
              {feedback.message}
            </div>
          )}

          {conflictWarning && !feedback.message && (
            <div className="bank-card" style={{ borderLeft: '4px solid #f59e0b', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: '#fcd34d', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>⚠️ {conflictWarning}</p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => handleSubmit(null, true)} className="btn-save" style={{ backgroundColor: '#4b5563' }}>Salvar Mesmo Assim</button>
                <button type="button" onClick={() => setConflictWarning(null)} className="btn-cancel" style={{ margin: 0, color: '#ef4444', borderColor: '#ef4444' }}>Revisar</button>
              </div>
            </div>
          )}

          {!conflictWarning && (
            <button type="submit" className="btn-save" disabled={loading || !profId || isSaldoInsuficiente} style={{ marginTop: '1rem' }}>
              {loading ? 'Processando...' : (eventToEdit ? (type === 'atestado' ? 'Atualizar Atestado' : 'Atualizar e Descontar') : (type === 'atestado' ? 'Salvar Atestado' : 'Confirmar e Descontar'))}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}