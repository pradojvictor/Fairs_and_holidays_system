import { useState, useEffect } from 'react';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import './index.css';


export default function AdminProfileModal({ isOpen, onClose, currentAdmin, onDataUpdated }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (isOpen) {
      setName(currentAdmin?.username || 'Administrador');
      setPassword(currentAdmin?.password || '');
      setFeedback({ type: '', message: '' });
    }
  }, [isOpen, currentAdmin]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: '', message: '' });

    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'O nome não pode ficar vazio.' });
      setLoading(false);
      return;
    }

    try {
      const currentData = await fetchGistData();
      currentData.auth = {
        username: name.trim(),
        password: password.trim()
      };
      await updateGistData(currentData);
      if (onDataUpdated) onDataUpdated();
      setFeedback({ type: 'success', message: 'Perfil atualizado com sucesso!' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao salvar os dados.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="event-modal-overlay">
      <div className="event-modal-container" style={{ maxWidth: '350px' }}>
        <div className="event-modal-header">
          <h3>Editar Perfil</h3>
          <button onClick={onClose} className="btn-close-modal">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>  
          <div className="form-group">
            <label>Nome de Exibição</label>
            <input 
              type="text" 
              className="form-input" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Admin"
              required
            />
          </div>
          <div className="form-group">
            <label>Nova Senha</label>
            <input 
              type="text"
              className="form-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Deixe em branco para manter a atual"
            />
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
              Nota: Certifique-se de atualizar seu arquivo de Login para validar esta nova senha.
            </p>
          </div>
          {feedback.message && (
            <p style={{ 
              color: feedback.type === 'error' ? '#ef4444' : '#10b981', 
              fontSize: '0.85rem', textAlign: 'center', margin: '0.5rem 0' 
            }}>
              {feedback.message}
            </p>
          )}
          <button type="submit" className="btn-submit-event" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </form>
      </div>
    </div>
  );
}