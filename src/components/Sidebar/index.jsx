// Arquivo: src/components/Sidebar.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import './index.css';

export default function Sidebar({ isOpen, onClose, onDataUpdated }) {
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  const handleAddProfessional = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const currentData = await fetchGistData();
      const newProfessional = {
        id: `p_${Date.now()}`,
        name: name.trim(),
        baseColor: color
      };
      currentData.professionals = [...(currentData.professionals || []), newProfessional];
      await updateGistData(currentData);

      setName('');
      setColor('#3b82f6');
      setFeedback({ type: 'success', message: 'Profissional adicionado!' });
      
      if (onDataUpdated) onDataUpdated();
      setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao salvar. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* O React usa classes dinâmicas. Se isOpen for true, adiciona a classe "open" */}
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      
      <div className={`sidebar-container ${isOpen ? 'open' : ''}`}>
        
        <div className="sidebar-header">
          <h2>Painel Administrativo</h2>
          <p>Logado como: <strong>admin</strong></p>
        </div>

        <div className="sidebar-body">
          <h3 className="sidebar-title">
            <span>Novo Profissional</span>
          </h3>

          <form onSubmit={handleAddProfessional} className="sidebar-form">
            <label>Nome do Funcionário</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              required
              className="sidebar-input"
            />

            <label>Cor de Identificação no Calendário</label>
            <div className="color-picker-wrapper">
              <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <span>{color}</span>
            </div>

            <button type="submit" disabled={loading} className="btn-save">
              {loading ? 'Salvando...' : 'Salvar Profissional'}
            </button>

            {feedback.message && (
              <p className="feedback-msg" style={{ color: feedback.type === 'error' ? '#ef4444' : '#10b981' }}>
                {feedback.message}
              </p>
            )}
          </form>
        </div>

        <button onClick={handleLogout} className="btn-logout">
          Sair do Sistema
        </button>
      </div>
    </>
  );
}