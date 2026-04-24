// Arquivo: src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGistData } from '../../services/githubApi';
import './index.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // NOVO: Estado para controlar a animação de saída
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
        
        // A MÁGICA ACONTECE AQUI:
        setIsExiting(true); // 1. Aciona a classe do CSS para a tela subir
        
        setTimeout(() => {
          navigate('/'); // 2. Só muda de página depois de 600 milissegundos (quando a animação acaba)
        }, 600); 
        
      } else {
        setError('Usuário ou senha incorretos.');
        setLoading(false); // Só destrava o botão se der erro
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor. Tente novamente.');
      console.error(err);
      setLoading(false);
    }
  };

  return (
    // Adicionamos a classe 'slide-up' quando isExiting for true
    <div className={`admin-login-container ${isExiting ? 'slide-up' : ''}`}>
      <form onSubmit={handleSubmit} className="admin-login-card">
        
        <div className="admin-login-header">
          <div className="admin-login-icon">🔒</div>
          <h2>Acesso Restrito</h2>
          <p>Painel de Administração</p>
        </div>
        
        {error && <div className="admin-login-error">{error}</div>}

        <div className="admin-input-group">
          <label>Usuário</label>
          <input 
            type="text" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Digite seu usuário"
          />
        </div>

        <div className="admin-input-group">
          <label>Senha</label>
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