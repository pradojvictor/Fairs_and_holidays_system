// Arquivo: src/components/EventModal.jsx
import { useEffect, useState } from 'react';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import './index.css';

export default function EventModal({ isOpen, onClose, professionals = [], events = [], onDataUpdated, eventToEdit }) {
  const [profId, setProfId] = useState('');
  const [type, setType] = useState('ferias');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLoteYear, setSelectedLoteYear] = useState(''); 
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [conflictWarning, setConflictWarning] = useState(null);
  // 👇 NOVO: O motivo volta, mas será obrigatório apenas para atestados
  const [reason, setReason] = useState('');

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
    setErrorMsg('');
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

  // 👇 MÁGICA: Só verifica saldo se NÃO for atestado
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
          mensagemSaldo = `SALDO INSUFICIENTE: O lote ${selectedLoteYear} tem apenas ${saldoReal} dia(s).`;
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
    setErrorMsg('');

    if (!profId) { setErrorMsg('Selecione um profissional.'); return; }
    if (startDate > endDate) { setErrorMsg('A data final não pode ser antes da inicial.'); return; }
    if (isSaldoInsuficiente) { setErrorMsg(mensagemSaldo); return; }
    
    // 👇 Exige motivo obrigatório para o atestado
    if (type === 'atestado' && !reason.trim()) { setErrorMsg('Para lançar um atestado, o MOTIVO (CID, Médico, etc) é obrigatório.'); return; }

    const hasPersonalConflict = events.some(existingEvent => {
      if (existingEvent.professionalId !== profId) return false;
      if (eventToEdit && existingEvent.id === eventToEdit.id) return false;
      return (startDate <= existingEvent.endDate) && (endDate >= existingEvent.startDate);
    });

    if (hasPersonalConflict) {
      setErrorMsg('Atenção: Este funcionário já possui uma ausência marcada neste período!');
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
        reason: type === 'atestado' ? reason.trim() : '', // Só salva o motivo se for atestado
        startDate: startDate,
        endDate: endDate,
        loteYear: type === 'ferias' ? selectedLoteYear : null 
      };

      if (eventToEdit) {
        currentData.events = currentData.events.map(e => e.id === eventToEdit.id ? savedEvent : e);
      } else {
        currentData.events = [...(currentData.events || []), savedEvent];
      }

      // 👇 MÁGICA: Se for atestado, a gente pula o desconto do banco!
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
      onClose();
    } catch (error) {
      console.error(error);
      setErrorMsg('Erro ao salvar o agendamento e o saldo.');
    } finally {
      setLoading(false);
    }
  };

  const sortedProfessionals = [...professionals].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="event-modal-overlay">
      <div className="event-modal-container">
        <div className="event-modal-header">
          <h3>{eventToEdit ? 'Editar Ausência' : 'Nova Ausência'}</h3>
          <button onClick={onClose} className="btn-close-modal">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          
          <div className="form-group">
            <label>Profissional</label>
            <select className="form-select" value={profId} onChange={(e) => setProfId(e.target.value)} disabled={eventToEdit}>
              <option value="">-- Selecione o funcionário --</option>
              {sortedProfessionals.map(pro => <option key={pro.id} value={pro.id}>{pro.name}</option>)}
            </select>
          </div>

          {profId && (
            <div className="form-group">
              <label>Tipo de Ausência</label>
              <div className="type-selector">
                <div className={`type-option ferias ${type === 'ferias' ? 'active' : ''}`} onClick={() => setType('ferias')}>Férias</div>
                <div className={`type-option folga ${type === 'folga' ? 'active' : ''}`} onClick={() => setType('folga')}>Folga</div>
                {/* 👇 O NOVO BOTÃO DE ATESTADO FICA AQUI 👇 */}
                <div className={`type-option atestado ${type === 'atestado' ? 'active' : ''}`} onClick={() => setType('atestado')}>Atestado</div>
              </div>
            </div>
          )}

          {profId && type === 'ferias' && (
            <div className="form-group" style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <label style={{ color: 'orange', fontWeight: 'bold' }}>Selecione o Lote de Férias a Descontar:</label>
              {Object.keys(saldosAtuais).length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#ef4444' }}>Este funcionário não tem férias lançadas no banco.</p>
              ) : (
                <select className="form-select" value={selectedLoteYear} onChange={(e) => setSelectedLoteYear(e.target.value)}>
                  <option value="">-- Selecione o Ano --</option>
                  {Object.values(saldosAtuais).map(saldo => (
                     <option key={saldo.year} value={saldo.year} disabled={saldo.days <= 0 && (!eventToEdit || eventToEdit.loteYear !== saldo.year)}>
                       {saldo.year} - Restam {saldo.days} dias ({saldo.category})
                     </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {profId && type === 'folga' && (
             <div className="form-group" style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Saldo Total de Folgas:</span>
                <strong style={{ color: saldoFolgasAtual > 0 ? '#10b981' : '#ef4444' }}>{saldoFolgasAtual} dias</strong>
             </div>
          )}

          {profId && (
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
          )}

          {calculatedDays > 0 && (
            <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Você está agendando {type !== 'atestado' && 'e descontando'}: <span style={{ color: 'orange', fontSize: '1.1rem' }}>{calculatedDays} dia(s)</span>
            </div>
          )}

          {/* 👇 EXIBE O CAMPO DE MOTIVO APENAS PARA ATESTADO 👇 */}
          {profId && type === 'atestado' && (
             <div className="form-group">
                <label>Motivo do Atestado (Obrigatório)</label>
                <input type="text" className="form-input" required placeholder="Ex: Retorno Médico, CID J01..." value={reason} onChange={(e) => setReason(e.target.value)} />
             </div>
          )}

          {errorMsg && <p className="error-msg-modal" style={{ color: '#dc2626', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '6px', fontSize: '0.85rem' }}>{errorMsg}</p>}
          
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
            <button type="submit" className="btn-submit-event" disabled={loading || !profId || isSaldoInsuficiente}>
              {loading ? 'Salvando...' : (eventToEdit ? (type === 'atestado' ? 'Atualizar Atestado' : 'Atualizar e Descontar') : (type === 'atestado' ? 'Salvar Atestado' : 'Confirmar e Descontar'))}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}