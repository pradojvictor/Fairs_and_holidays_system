// Arquivo: src/components/Sidebar.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import './index.css';

export default function Sidebar({ isOpen, onClose, onDataUpdated, professionals = [], professions = [], adminName, onOpenProfile }) {
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [professionId, setProfessionId] = useState('');
  const [shift, setShift] = useState('dia_todo');

  const [editingId, setEditingId] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  
  // NOVO: Estado para controlar o Modal de Exclusão
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, pro: null });

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

const handleEditClick = (pro) => {
    setEditingId(pro.id);
    setName(pro.name);
    setColor(pro.baseColor);
    setProfessionId(pro.professionId || ''); // NOVO
    setShift(pro.shift || 'dia_todo'); // NOVO
    setFeedback({ type: '', message: '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setColor('#3b82f6');
    setProfessionId(''); // NOVO
    setShift('dia_todo'); // NOVO
    setFeedback({ type: '', message: '' });
  };

  const handleSaveProfessional = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const currentData = await fetchGistData();
      let successMessage = '';
      
if (editingId) {
        currentData.professionals = currentData.professionals.map(p => 
          p.id === editingId ? { ...p, name: name.trim(), baseColor: color, professionId, shift } : p // ADICIONADO professionId, shift
        );
        successMessage = 'Profissional atualizado com sucesso!';
      } else {
        const newProfessional = {
          id: `p_${Date.now()}`,
          name: name.trim(),
          baseColor: color,
          professionId, // NOVO
          shift // NOVO
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
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao salvar os dados.' });
    } finally {
      setLoading(false);
    }
  };

  // NOVO: Apenas abre o modal e guarda quem queremos apagar
  const requestDelete = (pro) => {
    setDeleteModal({ isOpen: true, pro: pro });
  };

  // NOVO: Função que realmente vai no Gist e deleta, chamada pelo botão do Modal
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
      
      // Fecha o modal e mostra sucesso
      setDeleteModal({ isOpen: false, pro: null });
      setFeedback({ type: 'success', message: 'Profissional e eventos excluídos!' });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
      
    } catch (error) {
      console.error("Erro ao deletar:", error);
      setDeleteModal({ isOpen: false, pro: null });
      setFeedback({ type: 'error', message: 'Erro ao tentar excluir.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Overlay da Sidebar */}
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      
      <div className={`sidebar-container ${isOpen ? 'open' : ''}`}>
        
        {/* 2. SUBSTITUA A DIV DO SIDEBAR-HEADER POR ESTA: */}
        <div className="sidebar-header">
          <h2>Painel Administrativo</h2>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <p style={{ margin: 0 }}>Logado como: <strong>{adminName || 'admin'}</strong></p>
            
            <button 
              onClick={onOpenProfile}
              title="Editar Perfil"
              style={{ 
                background: 'transparent', border: '1px solid #4b5563', color: '#9ca3af', 
                padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#9ca3af'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.borderColor = '#4b5563'; }}
            >
              ✏️ Editar
            </button>
          </div>
        </div>

        <div className="sidebar-body">
          <h3 className="sidebar-title">
            <span>{editingId ? 'Editar Profissional' : 'Novo Profissional'}</span>
          </h3>

          <form onSubmit={handleSaveProfessional} className="sidebar-form">
            <label>Nome do Funcionário</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              required
              className="sidebar-input"
            />

            <label>Cargo / Profissão</label>
            <select value={professionId} onChange={(e) => setProfessionId(e.target.value)} required className="sidebar-input">
              <option value="">-- Selecione o Cargo --</option>
              {professions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label>Turno de Trabalho</label>
            <select value={shift} onChange={(e) => setShift(e.target.value)} required className="sidebar-input">
              <option value="manhã">Manhã</option>
              <option value="tarde">Tarde</option>
              <option value="dia_todo">Dia Todo (Ambos)</option>
            </select>

            <label>Cor no Calendário</label>
            <div className="color-picker-wrapper">
              <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <span>{color}</span>
            </div>

            <button type="submit" disabled={loading} className="btn-save">
              {loading ? 'Processando...' : (editingId ? 'Atualizar Dados' : 'Salvar Profissional')}
            </button>

            {editingId && (
              <button type="button" onClick={cancelEdit} className="btn-cancel" disabled={loading}>
                Cancelar Edição
              </button>
            )}

            {/* NOVO: Feedback Toast estilizado */}
            {feedback.message && (
              <div className={`feedback-toast ${feedback.type}`}>
                {feedback.message}
              </div>
            )}
          </form>

          <div className="pro-list-container">
            <h4 className="pro-list-title">Equipe Cadastrada ({professionals.length})</h4>
            <div className="pro-list">
              {professionals.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Nenhum cadastrado ainda.</p>
              ) : (
                professionals.map(pro => (
                  <div key={pro.id} className="pro-item">
                    <div className="pro-info">
                      <div className="pro-color" style={{ backgroundColor: pro.baseColor }}></div>
                      <span className="pro-name">{pro.name}</span>
                    </div>
                    <div className="pro-actions">
                      <button onClick={() => handleEditClick(pro)} className="btn-icon edit" title="Editar">✏️</button>
                      {/* O botão da lixeira agora chama o requestDelete */}
                      <button onClick={() => requestDelete(pro)} className="btn-icon delete" title="Excluir">🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <button onClick={handleLogout} className="btn-logout">
          Sair do Sistema
        </button>
      </div>

      {/* NOVO: Modal de Confirmação de Exclusão */}
      {deleteModal.isOpen && (
        <div className="modal-overlay-custom">
          <div className="modal-container">
            <h3>Confirmar Exclusão</h3>
            <p>Você tem certeza que deseja excluir <strong>{deleteModal.pro?.name}</strong>?</p>
            <p className="modal-warning">
              Aviso: Todas as férias e folgas deste funcionário desaparecerão do calendário permanentemente.
            </p>
            
            <div className="modal-actions">
              <button 
                className="btn-modal-cancel"
                onClick={() => setDeleteModal({ isOpen: false, pro: null })}
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                className="btn-modal-confirm"
                onClick={confirmDelete}
                disabled={loading}
              >
                {loading ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}