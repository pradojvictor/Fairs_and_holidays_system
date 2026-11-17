import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGistData, login } from '../../services/githubApi';
import './index.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExiting, setIsExiting] = useState(false); 
  const [lembrar, setLembrar] = useState(true);
  const navigate = useNavigate();

  // Quem marcou "manter conectado" e abre esta página já com sessão de admin vai direto ao painel.
  useEffect(() => {
    let ativo = true;
    fetchGistData()
      .then((d) => { if (ativo && d.perfil?.papel === 'admin') navigate('/', { replace: true }); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ tipo: 'admin', usuario: username, senha: password, lembrar });
      setIsExiting(true);
      setTimeout(() => {
        navigate('/');
      }, 600);
    } catch (err) {
      if (err.status === 401) setError('Usuário ou senha incorretos.');
      else if (err.status === 429) setError(err.message);
      else setError('Erro ao conectar com o servidor. Tente novamente.');
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
        <label className="admin-lembrar">
          <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
          <span>
            Manter conectado neste computador
            <small>Desmarque se o computador for compartilhado.</small>
          </span>
        </label>
        <button type="submit" disabled={loading} className="admin-btn-login">
          {loading ? (isExiting ? 'Entrando...' : 'Validando...') : 'Entrar no Sistema'}
        </button>
      </form>
    </div>
  );
}