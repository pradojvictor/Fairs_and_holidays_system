import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGistData } from '../../services/githubApi';


export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Busca os dados do nosso backend (que por sua vez busca do Gist)
      const data = await fetchGistData();
      
      // Valida as credenciais
      if (data.auth.username === username && data.auth.password === password) {
        // Sucesso! Salva no localStorage para manter logado
        localStorage.setItem('isAuthenticated', 'true');
        // Redireciona para a página principal (calendários)
        navigate('/');
      } else {
        setError('Usuário ou senha incorretos.');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6' }}>
      <form onSubmit={handleSubmit} style={{ padding: '2rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 1rem 0', fontFamily: 'sans-serif' }}>Acesso Restrito</h2>
        
        {error && <div style={{ color: 'red', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.875rem', marginBottom: '0.25rem', fontFamily: 'sans-serif' }}>Usuário</label>
          <input 
            type="text" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.875rem', marginBottom: '0.25rem', fontFamily: 'sans-serif' }}>Senha</label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '1rem' }}
        >
          {loading ? 'Validando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}