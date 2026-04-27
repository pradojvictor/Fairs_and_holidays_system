// Arquivo: src/components/BankSidebar.jsx
import { useState } from 'react';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import CustomSelect from '../CustomSelect';
import './index.css';

export default function BankSidebar({ isOpen, onClose, onDataUpdated, professionals = [], events = [] }) {
  const [selectedProId, setSelectedProId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Estado para o Modal de Exclusão do Log
  const [deleteLogModal, setDeleteLogModal] = useState({ isOpen: false, log: null, isFolga: false });

  const [folgaDays, setFolgaDays] = useState('');
  const [folgaReason, setFolgaReason] = useState('');

  const [feriasYear, setFeriasYear] = useState(new Date().getFullYear().toString());
  const [feriasType, setFeriasType] = useState('Individual');
  const [feriasDays, setFeriasDays] = useState('');

  const selectedPro = professionals.find(p => p.id === selectedProId);

  const showFeedback = (type, message, duration = 5000) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), duration); 
  };

  const handleAddFolga = async (e) => {
    e.preventDefault();
    if (!selectedProId || !folgaDays || !folgaReason.trim()) {
      showFeedback('error', 'Preencha a quantidade e o motivo!');
      return;
    }

    setLoading(true);
    try {
      const currentData = await fetchGistData();
      const newFolgaRecord = {
        id: `folga_${Date.now()}`,
        type: 'entrada',
        days: Math.abs(Number(folgaDays)),
        reason: folgaReason.trim(),
        createdAt: new Date().toLocaleDateString('pt-BR'),
        targetDate: null
      };

      const updatedProfessionals = currentData.professionals.map(pro => {
        if (pro.id === selectedProId) {
          const currentFolgas = Array.isArray(pro.bancoFolgas) ? pro.bancoFolgas : [];
          return { ...pro, bancoFolgas: [...currentFolgas, newFolgaRecord] };
        }
        return pro;
      });

      await updateGistData({ ...currentData, professionals: updatedProfessionals });
      setFolgaDays('');
      setFolgaReason('');
      if (onDataUpdated) onDataUpdated();
      showFeedback('success', 'Entrada de folga registrada!');
    } catch (error) {
      showFeedback('error', 'Erro ao registrar folga.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFerias = async (e) => {
    e.preventDefault();
    if (!selectedProId || !feriasYear || !feriasType || !feriasDays) return;

    const anoNumero = Number(feriasYear);
    if (feriasYear.length !== 4 || anoNumero < 2000 || anoNumero > 2100) {
      showFeedback('error', 'Por favor, digite um ano válido com 4 dígitos (Ex: 2026).');
      return;
    }

    setLoading(true);
    try {
      const currentData = await fetchGistData();
      const newFeriasRecord = {
        id: `ferias_${Date.now()}`,
        type: 'entrada',
        year: feriasYear,
        category: feriasType,
        days: Math.abs(Number(feriasDays)),
        createdAt: new Date().toLocaleDateString('pt-BR'),
        targetDate: null
      };

      const updatedProfessionals = currentData.professionals.map(pro => {
        if (pro.id === selectedProId) {
          const currentFerias = Array.isArray(pro.bancoFerias) ? pro.bancoFerias : [];
          return { ...pro, bancoFerias: [...currentFerias, newFeriasRecord] };
        }
        return pro;
      });

      await updateGistData({ ...currentData, professionals: updatedProfessionals });
      setFeriasDays('');
      if (onDataUpdated) onDataUpdated();
      showFeedback('success', 'Férias armazenadas com sucesso!');
    } catch (error) {
      showFeedback('error', 'Erro ao salvar férias.');
    } finally {
      setLoading(false);
    }
  };

  // --- NOVA LÓGICA DE EXCLUSÃO DE LOGS COM PROTEÇÃO E AVISO ---
  const requestDeleteLog = (logItem, isFolga) => {
    // PROTEÇÃO 1: Se for SAÍDA, impede de apagar se estiver no calendário
    if (logItem.type === 'saida') {
      const eventIdFromLog = logItem.id.replace('log_', ''); 
      const eventExistsInCalendar = events.find(e => e.id === eventIdFromLog);

      if (eventExistsInCalendar) {
        showFeedback('error', `ATENÇÃO: Não é possível apagar este registro por aqui! Ele está vinculado a uma ausência agendada no Calendário (${logItem.targetDate}). Vá em "Detalhes da Ausência" no calendário e exclua o agendamento lá.`, 10000);
        return; 
      }
    }

    // PROTEÇÃO 2: Se for ENTRADA, impede de apagar se for negativar o saldo
    if (logItem.type === 'entrada') {
      if (isFolga) {
        const saldoAtualFolgas = getSaldoFolgas(selectedPro);
        if (saldoAtualFolgas - logItem.days < 0) {
          showFeedback('error', `OPERAÇÃO BLOQUEADA: Você não pode excluir essa entrada de ${logItem.days} dia(s), pois deixaria o saldo de folgas negativo. Exclua agendamentos do calendário primeiro.`, 8000);
          return;
        }
      } else {
        const saldosFerias = getSaldosFerias(selectedPro);
        const saldoAtualDoAno = saldosFerias[logItem.year]?.days || 0;
        if (saldoAtualDoAno - logItem.days < 0) {
          showFeedback('error', `OPERAÇÃO BLOQUEADA: Você não pode excluir essa entrada pois os dias do lote ${logItem.year} já foram usados. Exclua as férias agendadas no calendário primeiro.`, 8000);
          return;
        }
      }
    }

    // Se chegou até aqui, é uma entrada válida para excluir ou uma saída fantasma.
    // Abre o modal de confirmação em vez de apagar direto!
    setDeleteLogModal({ isOpen: true, log: logItem, isFolga: isFolga });
  };

  // A função que realmente executa o delete após o "SIM" no Modal
  const confirmDeleteLog = async () => {
    setLoading(true);
    const logItem = deleteLogModal.log;
    const isFolga = deleteLogModal.isFolga;

    try {
      const currentData = await fetchGistData();
      const updatedProfessionals = currentData.professionals.map(pro => {
        if (pro.id === selectedProId) {
          if (isFolga) {
            return { ...pro, bancoFolgas: pro.bancoFolgas.filter(f => f.id !== logItem.id) };
          } else {
            return { ...pro, bancoFerias: pro.bancoFerias.filter(f => f.id !== logItem.id) };
          }
        }
        return pro;
      });

      await updateGistData({ ...currentData, professionals: updatedProfessionals });
      if (onDataUpdated) onDataUpdated();
      setDeleteLogModal({ isOpen: false, log: null, isFolga: false });
      showFeedback('success', 'Registro removido do histórico!');
    } catch (error) {
      showFeedback('error', 'Erro ao remover registro.');
      setDeleteLogModal({ isOpen: false, log: null, isFolga: false });
    } finally {
      setLoading(false);
    }
  };


  const getSaldoFolgas = (pro) => {
    if (!pro?.bancoFolgas || !Array.isArray(pro.bancoFolgas)) return 0;
    return pro.bancoFolgas.reduce((acc, log) => log.type === 'entrada' ? acc + log.days : acc - log.days, 0);
  };

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

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />

      <div className={`sidebar-container bank-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Banco de Ausências</h2>
          <div className="sidebar-header-actions">
            <p>Gerencie o <strong>Saldo de Direitos</strong></p>
            <button onClick={onClose} className="btn-close-bank">✖ Fechar</button>
          </div>
        </div>

        <div className="sidebar-split-layout bank-3-columns">
          
          <div className="sidebar-column">
            <h3 className="sidebar-title">1. Funcionário</h3>
            <div className="pro-list" style={{ marginTop: '1rem' }}>
              {professionals.map(pro => {
                const saldosFerias = getSaldosFerias(pro);
                const anosComSaldo = Object.keys(saldosFerias).filter(ano => saldosFerias[ano].days > 0).length;
                return (
                  <div 
                    key={pro.id} 
                    className={`pro-item bank-pro-item ${selectedProId === pro.id ? 'active' : ''}`}
                    onClick={() => setSelectedProId(pro.id)}
                  >
                    <div className="pro-info">
                      <div className="pro-color" style={{ backgroundColor: pro.baseColor }}></div>
                      <div className="pro-info-text">
                        <span className="pro-name" style={{ color: selectedProId === pro.id ? 'orange' : 'white' }}>{pro.name}</span>
                        <span className="pro-matricula">{getSaldoFolgas(pro)} Folga(s) • Férias em {anosComSaldo} ano(s)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sidebar-column">
            <h3 className="sidebar-title">2. Lançar Entradas</h3>
            {!selectedPro ? (
              <div className="bank-empty-state"><p>👈 Selecione um funcionário.</p></div>
            ) : (
              <div className="bank-management-area">
                {feedback.message && (
                  <div className={`feedback-toast ${feedback.type}`} style={{ marginBottom: '1rem' }}>{feedback.message}</div>
                )}
                
                <div className="bank-card">
                  <h4>🗓️ Crédito de Folgas</h4>
                  <form onSubmit={handleAddFolga} className="bank-form-column">
                    <input type="number" placeholder="Quantidade de Dias" className="sidebar-input" value={folgaDays} onChange={(e) => setFolgaDays(e.target.value)} disabled={loading} min="1" required />
                    <input type="text" placeholder="Motivo (Ex: Plantão 12/05)" className="sidebar-input" value={folgaReason} onChange={(e) => setFolgaReason(e.target.value)} disabled={loading} required />
                    <button type="submit" className="btn-save" disabled={loading}>{loading ? '⏳' : '+ Adicionar Folga'}</button>
                  </form>
                </div>

                <div className="bank-card" style={{ marginTop: '1.5rem' }}>
                  <h4>🏖️ Crédito de Férias</h4>
                  <form onSubmit={handleAddFerias} className="bank-form-column">
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label>Ano Ref.</label>
                        <input type="text" className="sidebar-input" placeholder="Ex: 2026" maxLength="4" value={feriasYear} onChange={(e) => setFeriasYear(e.target.value.replace(/\D/g, ''))} disabled={loading} required />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label>Dias</label>
                        <input type="number" className="sidebar-input" placeholder="Qtd Dias" value={feriasDays} onChange={(e) => setFeriasDays(e.target.value)} disabled={loading} min="1" required />
                      </div>
                    </div>
                    <CustomSelect label="Categoria" value={feriasType} onChange={setFeriasType} options={[{ value: 'Individual', label: 'Individual' }, { value: 'Licença', label: 'Licença' }]} />
                    <button type="submit" className="btn-save" disabled={loading}>{loading ? 'Processando...' : '+ Atribuir Férias'}</button>
                  </form>
                </div>
              </div>
            )}
          </div>

          <div className="sidebar-column sidebar-column-log">
            <h3 className="sidebar-title">3. Histórico e Saldos</h3>
            {!selectedPro ? (
              <div className="bank-empty-state"><p>👈 Selecione um funcionário.</p></div>
            ) : (
              <div className="bank-management-area">
                <div className="log-section">
                  <div className="log-header"><h4>Saldo de Folgas: <span className={getSaldoFolgas(selectedPro) > 0 ? 'text-green' : ''}>{getSaldoFolgas(selectedPro)}</span></h4></div>
                  <div className="log-list">
                    {(!selectedPro.bancoFolgas || selectedPro.bancoFolgas.length === 0) ? (
                      <p className="empty-msg">Nenhum log registrado.</p>
                    ) : (
                      selectedPro.bancoFolgas.map(log => {
                        const linkedEvent = log.type === 'saida' ? events.find(e => e.id === log.id.replace('log_', '')) : null;
                        const saidaText = linkedEvent?.reason 
                          ? `Uso em: ${log.targetDate} - ${linkedEvent.reason}` 
                          : (log.reason || `Uso em: ${log.targetDate}`);

                        return (
                          <div key={log.id} className={`log-item ${log.type === 'saida' ? 'log-out' : 'log-in'}`}>
                            <div className="log-item-main">
                              <span className="log-badge">{log.type === 'entrada' ? `+${log.days}` : `-${log.days}`}</span>
                              <span className="log-desc" title={log.type === 'entrada' ? log.reason : saidaText}>
                                {log.type === 'entrada' ? log.reason : saidaText}
                              </span>
                            </div>
                            <div className="log-item-meta">
                              <span>{log.type === 'entrada' ? `Lançado: ${log.createdAt}` : `Registrado: ${log.createdAt}`}</span>
                              <button onClick={() => requestDeleteLog(log, true)} className="btn-icon delete" disabled={loading}>🗑️</button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <hr className="log-divider" />

                <div className="log-section">
                  <div className="log-header"><h4>Saldos de Férias por Ano:</h4></div>
                  <div className="saldos-ferias-badges">
                    {Object.values(getSaldosFerias(selectedPro)).map(saldo => (
                      <div key={saldo.year} className={`saldo-badge ${saldo.days === 0 ? 'esgotado' : ''}`}>
                        <span>{saldo.year}</span><strong>{saldo.days} d</strong>
                      </div>
                    ))}
                  </div>

                  <div className="log-list" style={{ marginTop: '1rem' }}>
                    {(!selectedPro.bancoFerias || selectedPro.bancoFerias.length === 0) ? (
                      <p className="empty-msg">Nenhum log registrado.</p>
                    ) : (
                      selectedPro.bancoFerias.map(log => {
                        // 👇 MÁGICA: Busca o motivo direto do calendário para as FÉRIAS (se o RH digitou)
                        const linkedEvent = log.type === 'saida' ? events.find(e => e.id === log.id.replace('log_', '')) : null;
                        const saidaText = linkedEvent?.reason 
                          ? `Uso em: ${log.targetDate} - ${linkedEvent.reason}` 
                          : `Uso em: ${log.targetDate}`;

                        return (
                          <div key={log.id} className={`log-item ${log.type === 'saida' ? 'log-out' : 'log-in'}`}>
                            <div className="log-item-main">
                              <span className="log-badge">{log.type === 'entrada' || !log.type ? `+${log.days}` : `-${log.days}`}</span>
                              <span className="log-desc" title={log.type === 'entrada' || !log.type ? `Atribuição (${log.category || log.type})` : saidaText}>
                                {log.year} • {log.type === 'entrada' || !log.type ? `Atribuição (${log.category || log.type})` : saidaText}
                              </span>
                            </div>
                            <div className="log-item-meta">
                              <span>Lançado: {log.createdAt || log.registeredAt?.substring(0, 10)}</span>
                              <button onClick={() => requestDeleteLog(log, false)} className="btn-icon delete" disabled={loading}>🗑️</button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- O MODAL AMARELO DE EXCLUSÃO DE LOG --- */}
      {deleteLogModal.isOpen && (
        <div className="modal-overlay-custom" style={{ zIndex: 9999 }}>
          <div className="modal-container" style={{ borderLeft: '4px solid orange' }}>
            <h3 style={{ color: 'orange' }}>⚠️ Atenção: Exclusão Manual de Saldo</h3>
            <p>Você está prestes a excluir um registro de <strong>{deleteLogModal.log?.type} de {deleteLogModal.log?.days} dias</strong>.</p>
            <p className="modal-warning">Isso alterará definitivamente o banco do funcionário. Você tem certeza que deseja prosseguir com a exclusão?</p>
            
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setDeleteLogModal({ isOpen: false, log: null, isFolga: false })} disabled={loading}>Cancelar</button>
              <button className="btn-modal-confirm" onClick={confirmDeleteLog} disabled={loading}>{loading ? 'Excluindo...' : 'Sim, Excluir Saldo'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}