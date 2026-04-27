import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import Sidebar from '../../components/Sidebar';
import AnnualCalendar from '../../components/AnnualCalendar';
import EventModal from '../../components/EventModal';
import EventDetailModal from '../../components/EventDetailModal';
import MonthlySummary from '../../components/MonthlySummary';
import AdminProfileModal from '../../components/AdminProfileModal';
import ConfirmModal from '../../components/ConfirmModal';
import ProfessionalList from '../../components/ProfessionalList';
import RestScreen from '../../components/RestScreen';
import BankSidebar from '../../components/BankSidebar';
import CustomSelect from '../../components/CustomSelect';
import './index.css';

export default function Dashboard() {
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBankSidebarOpen, setIsBankSidebarOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [dbData, setDbData] = useState({ professionals: [], events: [], professions: [] });

  const [filterProf, setFilterProf] = useState('');
  const [filterType, setFilterType] = useState('');

  const [eventToEdit, setEventToEdit] = useState(null);

  const [isAdminProfileOpen, setIsAdminProfileOpen] = useState(false);
  const [adminData, setAdminData] = useState({ username: 'Administrador', password: '' });

  const [eventToDelete, setEventToDelete] = useState(null);

  const [shareFeedback, setShareFeedback] = useState('');

  const [isResting, setIsResting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchGistData();
      setDbData({ professionals: data.professionals || [], events: data.events || [], professions: data.professions || [] });
      if (data.auth) setAdminData(data.auth);
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

  const handleShare = async () => {
    const publicUrl = `${window.location.origin}/calendario`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Calendário da Equipe',
          text: 'Acesse o calendário de folgas e férias da nossa equipe aqui:',
          url: publicUrl,
        });
      } catch (err) {
        console.log('Compartilhamento cancelado ou falhou', err);
      }
    } else {
      navigator.clipboard.writeText(publicUrl);
      setShareFeedback('✅ Link copiado para a área de transferência!');
      setTimeout(() => {
        setShareFeedback('');
      }, 3000);
    }
  };

  const handleDeleteEvent = (eventId) => {
    setEventToDelete(eventId);
  };

  const executeDelete = async () => {
    if (!eventToDelete) return;

    setIsLoading(true);
    try {
      const currentData = await fetchGistData();
      const updatedEvents = (currentData.events || []).filter(e => String(e.id) !== String(eventToDelete));

      const updatedProfessionals = currentData.professionals.map(pro => {
        const newFolgas = (pro.bancoFolgas || []).filter(f => f.id !== `log_${eventToDelete}`);
        const newFerias = (pro.bancoFerias || []).filter(f => f.id !== `log_${eventToDelete}`);
        return { ...pro, bancoFolgas: newFolgas, bancoFerias: newFerias };
      });

      const newData = { ...currentData, events: updatedEvents, professionals: updatedProfessionals };

      await updateGistData(newData);

      setSelectedEvent(null);
      setEventToDelete(null);
      await loadData();

    } catch (err) {
      console.error("Falha ao deletar evento:", err);
      alert("Erro ao remover o evento. Verifique sua conexão.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEvents = dbData.events.filter(event => {
    const matchProf = filterProf ? event.professionalId === filterProf : true;
    const matchType = filterType ? event.type === filterType : true;
    return matchProf && matchType;
  });

  const filteredProfessionals = dbData.professionals.filter(pro => {
    return filterProf ? pro.id === filterProf : true;
  });

  const handleOpenNewEvent = () => {
    setEventToEdit(null);
    setIsEventModalOpen(true);
  };

  const handleEditEvent = (event) => {
    setSelectedEvent(null);
    setEventToEdit(event);
    setIsEventModalOpen(true);
  };

  return (
    <div className="dashboard-layout">

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        professionals={dbData.professionals}
        professions={dbData.professions}
        onDataUpdated={loadData}
        adminName={adminData.username}
        onOpenProfile={() => setIsAdminProfileOpen(true)}
      />

      <BankSidebar
        isOpen={isBankSidebarOpen}
        onClose={() => setIsBankSidebarOpen(false)}
        professionals={dbData.professionals}
        events={dbData.events}
        onDataUpdated={loadData}
      />

      <AdminProfileModal
        isOpen={isAdminProfileOpen}
        onClose={() => setIsAdminProfileOpen(false)}
        currentAdmin={adminData}
        onDataUpdated={loadData}
      />

      <header className="dashboard-header">
        <div className="header-left">
          <button className="btn-menu" onClick={() => setIsSidebarOpen(true)}>☰ Painel Administrativo</button>
          <button className="btn-bank" onClick={() => setIsBankSidebarOpen(true)}>Banco de Férias</button>
          <button className="btn-share" onClick={handleShare}>Compartilhar Link</button>
          <button className="btn-new-event" onClick={handleOpenNewEvent}>+ Nova Ausência</button>
        </div>

        <div className="header-actions">
          <h2 className="dashboard-title">Calendário de Ausências CAPS II LESTE</h2>
        </div>
        <button className="btn-pause" onClick={() => setIsResting(true)}>Pausar Sistema</button>
      </header>
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        professionals={dbData.professionals}
        events={dbData.events}
        onDataUpdated={loadData}
        eventToEdit={eventToEdit}
      />
      <EventDetailModal
        isOpen={!!selectedEvent}
        event={selectedEvent}
        professional={dbData.professionals.find(p => p.id === selectedEvent?.professionalId)}
        onClose={() => setSelectedEvent(null)}
        onDelete={handleDeleteEvent}
        onEdit={handleEditEvent}
      />
      <ConfirmModal
        isOpen={!!eventToDelete}
        title="Excluir Agendamento"
        message="Tem certeza que deseja remover esta ausência? Esta ação não poderá ser desfeita."
        isLoading={isLoading}
        onClose={() => setEventToDelete(null)}
        onConfirm={executeDelete}
      />
      <main className="dashboard-main">
        {isLoading ? <div className="status-container"><h2>Carregando...</h2></div> : null}
        {!isLoading && !error && (
          <>
            <div className="dashboard-top-section">
              <div className="filters-bar">
                <div className="filter-group">
                  <label>Filtrar Funcionário:</label>
                  <CustomSelect
                    value={filterProf}
                    onChange={setFilterProf}
                    options={[
                      { value: '', label: 'Todos' },
                      ...dbData.professionals.map(p => ({ value: p.id, label: p.name }))
                    ]}
                    customThemeClass="filter-select"
                  />
                </div>
                <div className="filter-group" >
                  <label>Filtrar Tipo:</label>
                  <CustomSelect
                    value={filterType}
                    onChange={setFilterType}
                    options={[
                      { value: '', label: 'Todos' },
                      { value: 'ferias', label: 'Apenas Férias' },
                      { value: 'folga', label: 'Apenas Folgas' }
                    ]}
                    customThemeClass="filter-select"
                  />
                </div>
              </div>
              <div className="calendar-wrapper">
                <AnnualCalendar professionals={dbData.professionals} events={filteredEvents} onEventClick={setSelectedEvent} />
              </div>
            </div>
            <MonthlySummary professionals={dbData.professionals} events={dbData.events} professions={dbData.professions} />
          </>
        )}
      </main>
      <ProfessionalList
        professionals={filteredProfessionals}
        events={filteredEvents}
      />
      {shareFeedback && (
        <div className="share-feedback-toast">
          {shareFeedback}
        </div>
      )}
      <RestScreen isActive={isResting} onWakeUp={() => setIsResting(false)} />
    </div>
  );
}