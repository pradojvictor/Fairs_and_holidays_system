import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGistData } from '../../services/githubApi';
import './index.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExiting, setIsExiting] = useState(false); 
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await fetchGistData();
      if (data.auth.username === username && data.auth.password === password) {
        localStorage.setItem('isAuthenticated', 'true');
        setIsExiting(true);
        setTimeout(() => {
          navigate('/');
        }, 600); 
      } else {
        setError('Usuário ou senha incorretos.');
        setLoading(false);
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor. Tente novamente.');
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className={`admin-login-container ${isExiting ? 'slide-up' : ''}`}>
      <form onSubmit={handleSubmit} className="admin-login-card">
        <div className="admin-login-header">
          <h2>Painel de Administração</h2>
          <p>Painel exclusivo do administrador</p>
        </div>
        {error && <div className="admin-login-error">{error}</div>}
        <div className="admin-input-group">
          <input 
            type="text" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Digite seu usuário"
          />
        </div>
        <div className="admin-input-group">
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Digite sua senha"
          />
        </div>
        <button type="submit" disabled={loading} className="admin-btn-login">
          {loading ? (isExiting ? 'Entrando...' : 'Validando...') : 'Entrar no Sistema'}
        </button>
      </form>
    </div>
  );
}