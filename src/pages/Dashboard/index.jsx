// Arquivo: src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import AnnualCalendar from '../../components/AnnualCalendar';
import { fetchGistData } from '../../services/githubApi';
import './index.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [dbData, setDbData] = useState({ professionals: [], events: [] });

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

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onDataUpdated={loadData} 
      />
      
      <header className="dashboard-header">
        <button className="btn-menu" onClick={() => setIsSidebarOpen(true)}>
          ☰ Menu
        </button>
        
        <h2 className="dashboard-title">Calendário de Ausências</h2>
        
        <button className="btn-header-logout" onClick={handleLogout}>
          Sair
        </button>
      </header>

      <main className="dashboard-main">
        {isLoading ? (
          <div className="status-container">
            <h2>Carregando calendário...</h2>
          </div>
        ) : error ? (
          <div className="status-container status-error">
            <h2>{error}</h2>
            <button className="btn-retry" onClick={loadData}>Tentar Novamente</button>
          </div>
        ) : (
          <div className="calendar-wrapper">
            <AnnualCalendar professionals={dbData.professionals} events={dbData.events} />
          </div>
        )}
      </main>
    </div>
  );
}