// Arquivo: src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import AnnualCalendar from '../../components/AnnualCalendar';
import { fetchGistData } from '../../services/githubApi';
import EventModal from '../../components/EventModal';
import EventDetailModal from '../../components/EventDetailModal';
import './index.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [dbData, setDbData] = useState({ professionals: [], events: [] });
  const [selectedEvent, setSelectedEvent] = useState(null);

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

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("Tem certeza que deseja remover este agendamento?")) return;
    
    setIsLoading(true);
    try {
      const currentData = await fetchGistData();
      currentData.events = currentData.events.filter(e => e.id !== eventId);
      
      await updateGistData(currentData);
      setSelectedEvent(null);
      await loadData(); // Recarrega o calendário
    } catch (err) {
      alert("Erro ao remover evento.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onDataUpdated={loadData}
        professionals={dbData.professionals}
      />
      
<header className="dashboard-header">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="btn-menu" onClick={() => setIsSidebarOpen(true)}>
            ☰ Menu
          </button>
          <h2 className="dashboard-title">Calendário de Ausências</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* O BOTÃO MÁGICO */}
          <button 
            onClick={() => setIsEventModalOpen(true)}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            + Nova Ausência
          </button>
          
          <button className="btn-header-logout" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <EventModal 
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        professionals={dbData.professionals}
        onDataUpdated={loadData}
      />

      <EventDetailModal 
        isOpen={!!selectedEvent}
        event={selectedEvent}
        professional={dbData.professionals.find(p => p.id === selectedEvent?.professionalId)}
        onClose={() => setSelectedEvent(null)}
        onDelete={handleDeleteEvent}
      />

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
            <AnnualCalendar 
            professionals={dbData.professionals} 
            events={dbData.events} 
            onEventClick={(event) => setSelectedEvent(event)}
            />
          </div>
        )}
      </main>
    </div>
  );
}