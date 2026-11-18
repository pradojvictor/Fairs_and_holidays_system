import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGistData, login, loginStatus } from '../../services/githubApi';
import './index.css';

const DIGITOS_PIN = 6;

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  // 'pin' quando este computador tem PIN (o servidor diz, pelo cookie do computador).
  const [modo, setModo] = useState('senha');
  const [computador, setComputador] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const navigate = useNavigate();

  // Quem marcou "manter conectado" e abre esta página já com sessão de admin vai direto ao painel.
  // E, se este computador tem PIN, a tela já abre pedindo o PIN.
  useEffect(() => {
    let ativo = true;
    fetchGistData()
      .then((d) => { if (ativo && d.perfil?.papel === 'admin') navigate('/', { replace: true }); })
      .catch(() => {});
    loginStatus()
      .then((r) => {
        if (!ativo || !r?.pin) return;
        setComputador({ nome: r.nome || '' });
        setModo('pin');
      })
      .catch(() => {});
    return () => { ativo = false; };
  }, [navigate]);

  const entrar = async (credenciais) => {
    setError('');
    setLoading(true);
    try {
      await login({ ...credenciais, lembrar });
      setIsExiting(true);
      setTimeout(() => {
        navigate('/');
      }, 600);
      return true;
    } catch (err) {
      setLoading(false);
      if (err.status === 401 || err.status === 429) return err;
      setError('Erro ao conectar com o servidor. Tente novamente.');
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = await entrar({ tipo: 'admin', usuario: username, senha: password });
    if (err?.status === 401) setError('Usuário ou senha incorretos.');
    else if (err?.status === 429) setError(err.message);
  };

  const handlePin = async (e) => {
    e.preventDefault();
    const err = await entrar({ tipo: 'pin', pin });
    if (!err || err === true) return;
    setError(err.message);
    setPin('');
    // Depois do quinto erro o PIN some deste computador: a tela volta para usuário e senha.
    const status = await loginStatus().catch(() => null);
    if (!status?.pin) {
      setComputador(null);
      setModo('senha');
    }
  };

  const trocarModo = (novo) => {
    setError('');
    setModo(novo);
  };

  const caixaLembrar = (
    <label className="admin-lembrar">
      <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
      <span>
        Manter conectado neste computador
        <small>Desmarque se o computador for compartilhado.</small>
      </span>
    </label>
  );

  if (modo === 'pin') {
    return (
      <div className={`admin-login-container ${isExiting ? 'slide-up' : ''}`}>
        <form onSubmit={handlePin} className="admin-login-card">
          <div className="admin-login-header">
            <h2>Painel de Administração</h2>
            <p>{computador?.nome ? `Entrar com o PIN · ${computador.nome}` : 'Entrar com o PIN deste computador'}</p>
          </div>
          {error && <div className="admin-login-error">{error}</div>}
          <div className="admin-input-group">
            <input
              className="admin-pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, DIGITOS_PIN))}
              required
              minLength={DIGITOS_PIN}
              aria-label={`PIN de ${DIGITOS_PIN} números`}
              placeholder="PIN"
            />
          </div>
          {caixaLembrar}
          <button type="submit" disabled={loading || pin.length !== DIGITOS_PIN} className="admin-btn-login">
            {loading ? (isExiting ? 'Entrando...' : 'Validando...') : 'Entrar com PIN'}
          </button>
          <button type="button" className="admin-trocar-modo" onClick={() => trocarModo('senha')}>
            Usar usuário e senha
          </button>
        </form>
      </div>
    );
  }

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
        {caixaLembrar}
        <button type="submit" disabled={loading} className="admin-btn-login">
          {loading ? (isExiting ? 'Entrando...' : 'Validando...') : 'Entrar no Sistema'}
        </button>
        {computador && (
          <button type="button" className="admin-trocar-modo" onClick={() => trocarModo('pin')}>
            Entrar com PIN
          </button>
        )}
      </form>
    </div>
  );
}
