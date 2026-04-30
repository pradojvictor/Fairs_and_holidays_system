// Arquivo: src/components/Sidebar.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import CustomSelect from '../CustomSelect';
import './index.css';

export default function Sidebar({ isOpen, onClose, onDataUpdated, professionals = [], professions = [], adminName, onOpenProfile }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [professionId, setProfessionId] = useState('');
  const [shift, setShift] = useState('dia_todo');
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, pro: null });
  const [deleteCargoModal, setDeleteCargoModal] = useState({ isOpen: false, cargo: null });
  const [newProfession, setNewProfession] = useState('');
  const [loadingProf, setLoadingProf] = useState(false);
  const [feedbackProf, setFeedbackProf] = useState({ type: '', message: '' });
  const [expandedCargoId, setExpandedCargoId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  const handleEditClick = (pro) => {
    setEditingId(pro.id);
    setName(pro.name);
    setMatricula(pro.matricula || '');
    setPassword(pro.password || '');
    setColor(pro.baseColor);
    setProfessionId(pro.professionId || '');
    setShift(pro.shift || 'dia_todo');
    setIsSupervisor(pro.isSupervisor || false);
    setFeedback({ type: '', message: '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setMatricula('');
    setPassword('');
    setColor('#3b82f6');
    setProfessionId('');
    setShift('dia_todo');
    setIsSupervisor(false);
    setFeedback({ type: '', message: '' });
  };

  const handleSaveProfessional = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: '', message: '' });

    const matriculaLimpa = matricula.trim();
    const nomeLimpo = name.trim();
    const senhaLimpa = password.trim();

    if (!matriculaLimpa) {
      setFeedback({ type: 'error', message: 'A matrícula não pode ficar em branco!' });
      setLoading(false);
      return;
    }
    
    if (!senhaLimpa) {
      setFeedback({ type: 'error', message: 'A senha de acesso é obrigatória!' });
      setLoading(false);
      return;
    }

    if (!professionId) {
      setFeedback({ type: 'error', message: 'Por favor, selecione o Cargo do funcionário.' });
      setLoading(false);
      return;
    }

    try {
      const currentData = await fetchGistData();
      let successMessage = '';

      if (editingId) {
        const matriculaExiste = currentData.professionals?.some(p => p.matricula === matriculaLimpa && p.id !== editingId);
        if (matriculaExiste) {
          setFeedback({ type: 'error', message: 'Esta matrícula já está sendo usada por outro funcionário!' });
          setLoading(false);
          return;
        }
        currentData.professionals = currentData.professionals.map(p =>
          // 👇 Salva a senha na atualização 👇
          p.id === editingId ? { ...p, name: nomeLimpo, matricula: matriculaLimpa, password: senhaLimpa, baseColor: color, professionId, shift, isSupervisor } : p
        );
        successMessage = 'Profissional atualizado com sucesso!';
      } else {
        const matriculaExiste = currentData.professionals?.some(p => p.matricula === matriculaLimpa);
        if (matriculaExiste) {
          setFeedback({ type: 'error', message: 'Erro: Já existe um funcionário com esta matrícula!' });
          setLoading(false);
          return;
        }
        const newProfessional = {
          id: `p_${Date.now()}`,
          name: nomeLimpo,
          matricula: matriculaLimpa,
          password: senhaLimpa, // 👇 Salva a senha no novo cadastro 👇
          baseColor: color,
          professionId,
          shift,
          isSupervisor
        };
        currentData.professionals = [...(currentData.professionals || []), newProfessional];
        successMessage = 'Novo profissional cadastrado!';
      }
      await updateGistData(currentData);
      cancelEdit();
      setFeedback({ type: 'success', message: successMessage });
      if (onDataUpdated) onDataUpdated();
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (error) {
      setFeedback({ type: 'error', message: 'Erro ao salvar os dados.' });
    } finally {
      setLoading(false);
    }
  };

  const requestDelete = (pro) => setDeleteModal({ isOpen: true, pro: pro });
  const confirmDelete = async () => {
    const id = deleteModal.pro.id;
    setLoading(true);
    try {
      const currentData = await fetchGistData();
      currentData.professionals = currentData.professionals.filter(p => p.id !== id);
      currentData.events = (currentData.events || []).filter(e => e.professionalId !== id);
      await updateGistData(currentData);
      if (editingId === id) cancelEdit();
      if (onDataUpdated) onDataUpdated();
      setDeleteModal({ isOpen: false, pro: null });
      setFeedback({ type: 'success', message: 'Profissional e eventos excluídos!' });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (error) {
      setDeleteModal({ isOpen: false, pro: null });
      setFeedback({ type: 'error', message: 'Erro ao tentar excluir.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddProfession = async (e) => {
    e.preventDefault();
    if (!newProfession.trim()) return;
    setLoadingProf(true);
    setFeedbackProf({ type: '', message: '' });
    try {
      const currentData = await fetchGistData();
      const newCargo = { id: `cargo_${Date.now()}`, name: newProfession.trim() };
      currentData.professions = [...(currentData.professions || []), newCargo];
      await updateGistData(currentData);
      setNewProfession('');
      if (onDataUpdated) onDataUpdated();
      setFeedbackProf({ type: 'success', message: 'Cargo salvo com sucesso!' });
      setTimeout(() => setFeedbackProf({ type: '', message: '' }), 3000);
    } catch (error) {
      setFeedbackProf({ type: 'error', message: 'Erro ao salvar o cargo.' });
    } finally {
      setLoadingProf(false);
    }
  };

  const requestDeleteCargo = (cargo, count) => {
    if (count > 0) {
      setFeedbackProf({
        type: 'error',
        message: `ATENÇÃO: Você não pode excluir o cargo "${cargo.name}" pois existem ${count} funcionário(s) vinculados a ele. Altere o cargo deles primeiro.`
      });
      setTimeout(() => setFeedbackProf({ type: '', message: '' }), 7000);
      return;
    }
    setDeleteCargoModal({ isOpen: true, cargo: cargo });
  };

  const confirmDeleteCargo = async () => {
    const id = deleteCargoModal.cargo.id;
    setLoadingProf(true);
    try {
      const currentData = await fetchGistData();
      currentData.professions = currentData.professions.filter(p => p.id !== id);
      await updateGistData(currentData);

      if (onDataUpdated) onDataUpdated();
      setDeleteCargoModal({ isOpen: false, cargo: null });
      setFeedbackProf({ type: 'success', message: 'Cargo excluído permanentemente!' });
      setTimeout(() => setFeedbackProf({ type: '', message: '' }), 4000);
    } catch (error) {
      setDeleteCargoModal({ isOpen: false, cargo: null });
      setFeedbackProf({ type: 'error', message: 'Erro ao tentar excluir cargo.' });
    } finally {
      setLoadingProf(false);
    }
  };

  const PRESET_COLORS = [
    '#F44336', '#D32F2F', '#B71C1C', '#8B0000', '#E91E63', '#C2185B', '#880E4F', '#F50057',
    '#9C27B0', '#7B1FA2', '#4A148C', '#651FFF', '#3F51B5', '#303F9F', '#1A237E', '#3D5AFE',
    '#2196F3', '#1976D2', '#0D47A1', '#0288D1', '#00BCD4', '#0097A7', '#006064', '#00838F',
    '#009688', '#00796B', '#004D40', '#26A69A', '#4CAF50', '#388E3C', '#1B5E20', '#00C853',
    '#8BC34A', '#689F38', '#33691E', '#AFB42B', '#FFB300', '#FF8F00', '#F57F17', '#E65100',
    '#FF9800', '#F57C00', '#FF5722', '#BF360C', '#795548', '#4E342E', '#607D8B', '#263238', '#424242', '#000000'
  ];

  const removeAccents = (str) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const filteredAndSortedProfessionals = [...professionals]
    .filter(pro => {
      const term = removeAccents(searchTerm.toLowerCase());
      const matchName = removeAccents(pro.name.toLowerCase()).includes(term);
      const matchMatricula = pro.matricula && removeAccents(pro.matricula.toLowerCase()).includes(term);
      return matchName || matchMatricula;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`sidebar-container ${isOpen ? 'open' : ''}`}>

        <div className="sidebar-header">
          <h2>Painel Administrativo</h2>
          <div className="sidebar-header-actions">
            <p>Logado como: <strong>{adminName || 'admin'}</strong></p>
            <button onClick={onOpenProfile} title="Editar Perfil" className="btn-edit-profile">
              <svg clipRule="evenodd" fillRule="evenodd" strokeLinejoin="round" strokeMiterlimit={2} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="m19 20.25c0-.402-.356-.75-.75-.75-2.561 0-11.939 0-14.5 0-.394 0-.75.348-.75.75s.356.75.75.75h14.5c.394 0 .75-.348.75-.75zm-12.023-7.083c-1.334 3.916-1.48 4.232-1.48 4.587 0 .527.46.749.749.749.352 0 .668-.137 4.574-1.493zm1.06-1.061 3.846 3.846 8.824-8.814c.195-.195.293-.451.293-.707 0-.255-.098-.511-.293-.706-.692-.691-1.742-1.741-2.435-2.432-.195-.195-.451-.293-.707-.293-.254 0-.51.098-.706.293z" fillRule="nonzero" />
              </svg>
              Editar
            </button>
          </div>
        </div>

        <div className="sidebar-split-layout">
          <div className="sidebar-column">
            <h3 className="sidebar-title">
              <span>{editingId ? 'Editar Profissional' : 'Novo Profissional'}</span>
            </h3>
            <div className="column-scroll-content">
              <form onSubmit={handleSaveProfessional} className="sidebar-form">
                <label>Nome do Funcionário</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João Silva" required className="sidebar-input" />
                <label>Matrícula ( Senha de Acesso )</label>
                <input type="text" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Ex: 12345" required className="sidebar-input" />
              <label>Senha de Acesso</label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ex: 123456" required className="sidebar-input" />
                <div className="custom-toggle-container" onClick={() => setIsSupervisor(!isSupervisor)}>
                  <div className="custom-toggle-track">
                    <div className={`custom-toggle-knob ${isSupervisor ? 'active' : ''}`}>
                      {isSupervisor && <span className="custom-toggle-text">Supervisor</span>}
                    </div>
                  </div>
                  <div className="custom-toggle-labels">
                    <span>Pode ver a escala da equipe.</span>
                  </div>
                </div>
                <CustomSelect
                  label="Cargo / Profissão"
                  placeholder="-- Selecione o Cargo --"
                  value={professionId}
                  onChange={setProfessionId}
                  options={professions.map(p => ({ value: p.id, label: p.name }))}
                />
                <CustomSelect
                  label="Turno de Trabalho"
                  placeholder="-- Selecione o Turno --"
                  value={shift}
                  onChange={setShift}
                  options={[
                    { value: 'manhã', label: 'Manhã' },
                    { value: 'tarde', label: 'Tarde' },
                    { value: 'dia_todo', label: 'Dia Todo (Ambos)' }
                  ]}
                />
                <CustomSelect
                  label="Cor no Calendário"
                  variant="color"
                  value={color}
                  onChange={setColor}
                  options={PRESET_COLORS}
                />
                <button type="submit" disabled={loading} className="btn-save">
                  {loading ? 'Processando...' : (editingId ? 'Atualizar Dados' : 'Salvar Profissional')}
                </button>
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="btn-cancel" disabled={loading}>Cancelar Edição</button>
                )}
                {feedback.message && (
                  <div className={`feedback-toast ${feedback.type}`}>{feedback.message}</div>
                )}
              </form>

              <div className="pro-list-container">
                <h4 className="pro-list-title">Equipe Cadastrada ({professionals.length})</h4>

                <input
                  type="text"
                  className="sidebar-input search-pro-input"
                  placeholder="Buscar por nome ou matrícula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <div className="pro-list">
                  {filteredAndSortedProfessionals.length === 0 ? (
                    <p className="empty-msg">Nenhum profissional encontrado para "{searchTerm}"</p>
                  ) : (
                    filteredAndSortedProfessionals.map(pro => (
                      <div key={pro.id} className="pro-item">
                        <div className="pro-info">
                          <div className="pro-color" style={{ backgroundColor: pro.baseColor }}></div>
                          <div className="pro-info-text">
                            <span className="pro-name">
                              {pro.name}
                              {pro.isSupervisor && <span title="Supervisor" className="pro-supervisor-icon">
                                <svg clipRule="evenodd" fillRule="evenodd" strokeLinejoin="round" strokeMiterlimit={2} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path d="m11.322 2.923c.126-.259.39-.423.678-.423.289 0 .552.164.678.423.974 1.998 2.65 5.44 2.65 5.44s3.811.524 6.022.829c.403.055.65.396.65.747 0 .19-.072.383-.231.536-1.61 1.538-4.382 4.191-4.382 4.191s.677 3.767 1.069 5.952c.083.462-.275.882-.742.882-.122 0-.244-.029-.355-.089-1.968-1.048-5.359-2.851-5.359-2.851s-3.391 1.803-5.359 2.851c-.111.06-.234.089-.356.089-.465 0-.825-.421-.741-.882.393-2.185 1.07-5.952 1.07-5.952s-2.773-2.653-4.382-4.191c-.16-.153-.232-.346-.232-.535 0-.352.249-.694.651-.748 2.211-.305 6.021-.829 6.021-.829s1.677-3.442 2.65-5.44z" fillRule="nonzero" />
                                </svg>
                              </span>}
                            </span>
                            <span className="pro-matricula">Mat: {pro.matricula || 'S/N'}</span>
                          </div>
                        </div>
                        <div className="pro-actions">
                          <button onClick={() => handleEditClick(pro)} className="btn-icon edit" title="Editar">
                            <svg clipRule="evenodd" fillRule="evenodd" strokeLinejoin="round" strokeMiterlimit={2} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path d="m11.239 15.533c-1.045 3.004-1.238 3.451-1.238 3.84 0 .441.385.627.627.627.272 0 1.108-.301 3.829-1.249zm.888-.888 3.22 3.22 6.408-6.401c.163-.163.245-.376.245-.591 0-.213-.082-.427-.245-.591-.58-.579-1.458-1.457-2.039-2.036-.163-.163-.377-.245-.591-.245-.213 0-.428.082-.592.245zm-3.127-.895c0-.402-.356-.75-.75-.75-2.561 0-2.939 0-5.5 0-.394 0-.75.348-.75.75s.356.75.75.75h5.5c.394 0 .75-.348.75-.75zm5-3c0-.402-.356-.75-.75-.75-2.561 0-7.939 0-10.5 0-.394 0-.75.348-.75.75s.356.75.75.75h10.5c.394 0 .75-.348.75-.75zm0-3c0-.402-.356-.75-.75-.75-2.561 0-7.939 0-10.5 0-.394 0-.75.348-.75.75s.356.75.75.75h10.5c.394 0 .75-.348.75-.75zm0-3c0-.402-.356-.75-.75-.75-2.561 0-7.939 0-10.5 0-.394 0-.75.348-.75.75s.356.75.75.75h10.5c.394 0 .75-.348.75-.75z" fillRule="nonzero" />
                            </svg>
                          </button>
                          <button onClick={() => requestDelete(pro)} className="btn-icon delete" title="Excluir">
                            <svg clipRule="evenodd" fillRule="evenodd" strokeLinejoin="round" strokeMiterlimit={2} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path d="m20.015 6.506h-16v14.423c0 .591.448 1.071 1 1.071h14c.552 0 1-.48 1-1.071 0-3.905 0-14.423 0-14.423zm-5.75 2.494c.414 0 .75.336.75.75v8.5c0 .414-.336.75-.75.75s-.75-.336-.75-.75v-8.5c0-.414.336-.75.75-.75zm-4.5 0c.414 0 .75.336.75.75v8.5c0 .414-.336.75-.75.75s-.75-.336-.75-.75v-8.5c0-.414.336-.75.75-.75zm-.75-5v-1c0-.535.474-1 1-1h4c.526 0 1 .465 1 1v1h5.254c.412 0 .746.335.746.747s-.334.747-.746.747h-16.507c-.413 0-.747-.335-.747-.747s.334-.747.747-.747zm4.5 0v-.5h-3v.5z" fillRule="nonzero" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="sidebar-column">

            <h3 className="sidebar-title">
              <span>Gerenciar Cargos</span>
            </h3>
            <div className="column-scroll-content">
              <form onSubmit={handleAddProfession} className="sidebar-form">
                <label>Nome do Cargo</label>
                <div className="cargo-input-group">
                  <input
                    type="text"
                    value={newProfession}
                    onChange={(e) => setNewProfession(e.target.value)}
                    placeholder="Ex: Enfermagem..."
                    required
                    className="sidebar-input no-margin"
                    disabled={loadingProf}
                  />
                  <button type="submit" disabled={loadingProf} className="btn-save btn-add-cargo">
                    {loadingProf ? '⏳' : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M24 10h-10v-10h-4v10h-10v4h10v10h4v-10h10z" /></svg>}
                  </button>
                </div>
                {feedbackProf.message && (
                  <div className={`feedback-toast ${feedbackProf.type}`}>
                    {feedbackProf.message}
                  </div>
                )}
              </form>

              <div className="pro-list-container cargo-list-container">
                <h4 className="pro-list-title">Cargos Cadastrados ({professions.length})</h4>
                <div className="pro-list">
                  {professions.length === 0 ? (
                    <p className="empty-msg">Nenhum cargo criado.</p>
                  ) : (
                    professions.map(p => {
                      const profsInCargo = professionals.filter(pro => pro.professionId === p.id);
                      const count = profsInCargo.length;
                      const isExpanded = expandedCargoId === p.id;
                      return (
                        <div key={p.id} className="cargo-accordion-wrapper">
                          <div className={`pro-item cargo-item ${isExpanded ? 'expanded' : ''}`}>
                            <div className="cargo-item-main" onClick={() => setExpandedCargoId(isExpanded ? null : p.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span className="cargo-name">
                                {p.name}
                                <span className="cargo-arrow">{isExpanded ? '▲' : '▼'}</span>
                              </span>
                              <span className={`cargo-badge ${count > 0 ? 'active' : ''}`} title={`${count} profissional(is) neste cargo`}>
                                {count}
                              </span>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); requestDeleteCargo(p, count); }}
                              className="btn-icon delete btn-delete-cargo"
                              title="Excluir Cargo"
                            >
                              <svg clipRule="evenodd" fillRule="evenodd" strokeLinejoin="round" strokeMiterlimit={2} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="m20.015 6.506h-16v14.423c0 .591.448 1.071 1 1.071h14c.552 0 1-.48 1-1.071 0-3.905 0-14.423 0-14.423zm-5.75 2.494c.414 0 .75.336.75.75v8.5c0 .414-.336.75-.75.75s-.75-.336-.75-.75v-8.5c0-.414.336-.75.75-.75zm-4.5 0c.414 0 .75.336.75.75v8.5c0 .414-.336.75-.75.75s-.75-.336-.75-.75v-8.5c0-.414.336-.75.75-.75zm-.75-5v-1c0-.535.474-1 1-1h4c.526 0 1 .465 1 1v1h5.254c.412 0 .746.335.746.747s-.334.747-.746.747h-16.507c-.413 0-.747-.335-.747-.747s.334-.747.747-.747zm4.5 0v-.5h-3v.5z" fillRule="nonzero" />
                              </svg>
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="cargo-expanded-content">
                              {count === 0 ? (
                                <span className="cargo-empty-msg">Nenhum funcionário neste cargo.</span>
                              ) : (
                                <ul className="cargo-pro-list">
                                  {profsInCargo.map(pro => (
                                    <li key={pro.id} className="cargo-pro-item">
                                      <span className="cargo-pro-color" style={{ backgroundColor: pro.baseColor }}></span>
                                      <span>
                                        {pro.name}
                                        <span className="cargo-pro-shift">
                                          ({pro.shift === 'dia_todo' ? 'Dia Todo' : pro.shift})
                                        </span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="sidebar-column-footer">
              <button onClick={handleLogout} className="btn-logout">
                Sair do Sistema
              </button>
            </div>

          </div>
        </div>
      </div>

      {deleteModal.isOpen && (
        <div className="modal-overlay-custom">
          <div className="modal-container">
            <h3>Confirmar Exclusão</h3>
            <p>Você tem certeza que deseja excluir <strong>{deleteModal.pro?.name}</strong>?</p>
            <p className="modal-warning">Aviso: Todas as férias e folgas deste funcionário desaparecerão do calendário permanentemente.</p>
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setDeleteModal({ isOpen: false, pro: null })} disabled={loading}>Cancelar</button>
              <button className="btn-modal-confirm" onClick={confirmDelete} disabled={loading}>{loading ? 'Excluindo...' : 'Sim, Excluir'}</button>
            </div>
          </div>
        </div>
      )}
      {deleteCargoModal.isOpen && (
        <div className="modal-overlay-custom">
          <div className="modal-container" style={{ borderLeftColor: '#ef4444' }}>
            <h3 style={{ color: '#ef4444' }}>Deletar Cargo</h3>
            <p>Deseja remover o cargo <strong>{deleteCargoModal.cargo?.name}</strong>?</p>
            <p className="modal-warning">Esta ação apagará este cargo da lista permanentemente.</p>
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setDeleteCargoModal({ isOpen: false, cargo: null })} disabled={loadingProf}>Cancelar</button>
              <button className="btn-modal-confirm" onClick={confirmDeleteCargo} disabled={loadingProf}>{loadingProf ? 'Removendo...' : 'Sim, Remover Cargo'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}