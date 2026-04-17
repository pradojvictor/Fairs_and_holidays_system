// Arquivo: src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { fetchGistData } from '../services/githubApi';


export default function Dashboard() {
  const navigate = useNavigate();
  
  // Estados para controlar a interface e os dados
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Onde vamos guardar o "banco de dados" inteiro
  const [dbData, setDbData] = useState({ professionals: [], events: [] });

  // Função para buscar os dados na API
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchGistData();
      setDbData({
        professionals: data.professionals || [],
        events: data.events || []
      });
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar os dados do calendário.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quando a tela carregar pela primeira vez, busca os dados
  useEffect(() => {
    loadData();
  }, []);

  // Botão rápido de logout (útil no cabeçalho também)
  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
      
      {/* Componente da Aba Lateral */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onDataUpdated={loadData} // Quando salvar um novo profissional, recarrega a tela!
      />
      
      {/* Cabeçalho Superior */}
      <header style={{ padding: '1rem 2rem', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#1f2937', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
        >
          ☰ Menu
        </button>
        
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#111827' }}>Calendário de Ausências</h2>
        
        <button 
          onClick={handleLogout}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '4px' }}
        >
          Sair
        </button>
      </header>

      {/* Área Principal - Onde o Calendário vai entrar */}
      <main style={{ padding: '2rem', flexGrow: 1, overflowX: 'auto' }}>
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            <h2>Carregando calendário...</h2>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#ef4444' }}>
            <h2>{error}</h2>
            <button onClick={loadData} style={{ padding: '0.5rem 1rem', marginTop: '1rem' }}>Tentar Novamente</button>
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            
            {/* INÍCIO DO PLACEHOLDER DO CALENDÁRIO */}
            <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed #d1d5db', borderRadius: '8px' }}>
              <h3 style={{ color: '#374151' }}>O Calendário Anual será renderizado aqui!</h3>
              <p style={{ color: '#6b7280' }}>
                Atualmente temos <strong>{dbData.professionals.length}</strong> profissionais cadastrados e <strong>{dbData.events.length}</strong> eventos agendados.
              </p>
            </div>
            {/* FIM DO PLACEHOLDER DO CALENDÁRIO */}

          </div>
        )}

      </main>
    </div>
  );
}