// Arquivo: src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import AnnualCalendar from '../../components/AnnualCalendar';
import { fetchGistData } from '../../services/githubApi';
import EventModal from '../../components/EventModal';
import EventDetailModal from '../../components/EventDetailModal';
import MonthlySummary from '../../components/MonthlySummary';
import './index.css';

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [dbData, setDbData] = useState({ professionals: [], events: [] });

  // ESTADOS PARA OS FILTROS
  const [filterProf, setFilterProf] = useState('');
  const [filterType, setFilterType] = useState('');

  const [eventToEdit, setEventToEdit] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchGistData();
      setDbData({ professionals: data.professionals || [], events: data.events || [] });
    } catch (err) {
      setError('Erro ao carregar os dados.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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
      await loadData();
    } catch (err) {
      alert("Erro ao remover evento.");
    } finally {
      setIsLoading(false);
    }
  };

  // LÓGICA DE FILTRAGEM
  const filteredEvents = dbData.events.filter(event => {
    const matchProf = filterProf ? event.professionalId === filterProf : true;
    const matchType = filterType ? event.type === filterType : true;
    return matchProf && matchType;
  });

  // Logo antes do 'return'
  const handleOpenNewEvent = () => {
    setEventToEdit(null); // Garante que o form vem vazio
    setIsEventModalOpen(true);
  };

  const handleEditEvent = (event) => {
    setSelectedEvent(null); // Fecha a janelinha de detalhes
    setEventToEdit(event);  // Manda os dados pro formulário
    setIsEventModalOpen(true); // Abre o formulário
  };

  return (
    <div className="dashboard-layout">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} professionals={dbData.professionals} onDataUpdated={loadData} />
      
      <header className="dashboard-header">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="btn-menu" onClick={() => setIsSidebarOpen(true)}>☰ Menu</button>
          <h2 className="dashboard-title">Calendário de Ausências</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={handleOpenNewEvent} style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Nova Ausência</button>
          <button className="btn-header-logout" onClick={handleLogout}>Sair</button>
        </div>
      </header>

     {/* Passe a prop eventToEdit para o form */}
      <EventModal 
        isOpen={isEventModalOpen} 
        onClose={() => setIsEventModalOpen(false)} 
        professionals={dbData.professionals} 
        onDataUpdated={loadData} 
        eventToEdit={eventToEdit} /* <-- NOVO */
      />
      
      {/* Passe a função onEdit para os detalhes */}
      <EventDetailModal 
        isOpen={!!selectedEvent} 
        event={selectedEvent} 
        professional={dbData.professionals.find(p => p.id === selectedEvent?.professionalId)} 
        onClose={() => setSelectedEvent(null)} 
        onDelete={handleDeleteEvent} 
        onEdit={handleEditEvent} /* <-- NOVO */
      />

      {/* NOVO LAYOUT DO MAIN: Flex column com Gap para separar as metades */}
      <main className="dashboard-main" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {isLoading ? <div className="status-container"><h2>Carregando...</h2></div> : null}
        
        {!isLoading && !error && (
          <>
            {/* PARTE SUPERIOR: Filtros + Calendário Anual */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* BARRA DE FILTROS */}
              <div style={{ display: 'flex', gap: '1rem', backgroundColor: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#374151' }}>Filtrar Funcionário:</label>
                  <select value={filterProf} onChange={(e) => setFilterProf(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                    <option value="">Todos</option>
                    {dbData.professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#374151' }}>Filtrar Tipo:</label>
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                    <option value="">Todos</option>
                    <option value="ferias">Apenas Férias</option>
                    <option value="folga">Apenas Folgas</option>
                  </select>
                </div>
              </div>

              {/* CALENDÁRIO ANUAL (Agora usa os filteredEvents!) */}
              <div className="calendar-wrapper">
                <AnnualCalendar professionals={dbData.professionals} events={filteredEvents} onEventClick={setSelectedEvent} />
              </div>
            </div>

            {/* PARTE INFERIOR: Resumo do Mês (Calendário Menor + Cards) */}
            <MonthlySummary professionals={dbData.professionals} events={dbData.events} />
          </>
        )}
      </main>
    </div>
  );
}