// Arquivo: src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import AnnualCalendar from '../../components/AnnualCalendar';
import { fetchGistData, updateGistData } from '../../services/githubApi';
import EventModal from '../../components/EventModal';
import EventDetailModal from '../../components/EventDetailModal';
import MonthlySummary from '../../components/MonthlySummary';
import AdminProfileModal from '../../components/AdminProfileModal';
import ConfirmModal from '../../components/ConfirmModal';
import ProfessionalList from '../../components/ProfessionalList';
import ProfessionManagerModal from '../../components/ProfessionManagerModal';
import RestScreen from '../../components/RestScreen';
import './index.css';

export default function Dashboard() {
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isProfManagerOpen, setIsProfManagerOpen] = useState(false); // NOVO
  const [dbData, setDbData] = useState({ professionals: [], events: [], professions: [] }); // ADICIONADO professions

  // ESTADOS PARA OS FILTROS
  const [filterProf, setFilterProf] = useState('');
  const [filterType, setFilterType] = useState('');

  const [eventToEdit, setEventToEdit] = useState(null);

  const [isAdminProfileOpen, setIsAdminProfileOpen] = useState(false);
  const [adminData, setAdminData] = useState({ username: 'Administrador', password: '' });

  const [eventToDelete, setEventToDelete] = useState(null); // Guarda a ID do evento que queremos excluir

  const [shareFeedback, setShareFeedback] = useState('');

  const [isResting, setIsResting] = useState(false); // NOVO: Controle da tela de descanso

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

  // 👇 NOVA FUNÇÃO DE COMPARTILHAMENTO 👇
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
      // 1. Copia o link silenciosamente
      navigator.clipboard.writeText(publicUrl);

      // 2. Aciona o nosso aviso bonito no lugar do alert() feio
      setShareFeedback('✅ Link copiado para a área de transferência!');

      // 3. Apaga o aviso sozinho após 3 segundos
      setTimeout(() => {
        setShareFeedback('');
      }, 3000);
    }
  };

  // Esta função agora apenas ABRIRÁ o nosso novo modal customizado
  const handleDeleteEvent = (eventId) => {
    setEventToDelete(eventId);
  };

  // Esta é a função que o botão vermelho do Modal vai chamar
  const executeDelete = async () => {
    if (!eventToDelete) return;

    setIsLoading(true);
    try {
      const currentData = await fetchGistData();
      const updatedEvents = (currentData.events || []).filter(e => String(e.id) !== String(eventToDelete));
      const newData = { ...currentData, events: updatedEvents };

      await updateGistData(newData);

      setSelectedEvent(null); // Fecha o modal de detalhes
      setEventToDelete(null); // Fecha o modal de confirmação
      await loadData();

    } catch (err) {
      console.error("Falha ao deletar evento:", err);
      alert("Erro ao remover o evento. Verifique sua conexão.");
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

  const filteredProfessionals = dbData.professionals.filter(pro => {
    return filterProf ? pro.id === filterProf : true;
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

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        professionals={dbData.professionals}
        professions={dbData.professions} /* <-- NOVO */
        onDataUpdated={loadData}
        adminName={adminData.username}
        onOpenProfile={() => setIsAdminProfileOpen(true)}
      />

      {/* RENDERIZE O NOVO MODAL (Pode colocar logo abaixo da chamada da Sidebar) */}
      <AdminProfileModal
        isOpen={isAdminProfileOpen}
        onClose={() => setIsAdminProfileOpen(false)}
        currentAdmin={adminData}
        onDataUpdated={loadData}
      />

      <header className="dashboard-header">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="btn-menu" onClick={() => setIsSidebarOpen(true)}>☰ Menu</button>
          <h2 className="dashboard-title">Calendário de Ausências</h2>
        </div>

        {/* NOSSO NOVO BOTÃO DE COMPARTILHAR */}

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={handleShare} style={{ padding: '0.5rem 1rem', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            📤 Compartilhar Link
          </button>
          {/* NOVO BOTÃO DE CARGOS */}
          <button onClick={() => setIsProfManagerOpen(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>⚙️ Cargos</button>
          <button onClick={handleOpenNewEvent} style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Nova Ausência</button>
          <button className="btn-header-logout" onClick={handleLogout}>Sair</button>
        </div>

        <button
          onClick={() => setIsResting(true)}
          style={{
            backgroundColor: '#374151', color: 'white', border: 'none',
            padding: '8px 15px', borderRadius: '8px', cursor: 'pointer',
            fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          ☕ Pausar Sistema
        </button>
      </header>

      {/* Passe a prop eventToEdit para o form */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        professionals={dbData.professionals}
        events={dbData.events}
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

      <ConfirmModal
        isOpen={!!eventToDelete}
        title="Excluir Agendamento"
        message="Tem certeza que deseja remover esta ausência? Esta ação não poderá ser desfeita."
        isLoading={isLoading}
        onClose={() => setEventToDelete(null)}
        onConfirm={executeDelete}
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
            <MonthlySummary professionals={dbData.professionals} events={dbData.events} professions={dbData.professions} />
          </>
        )}
      </main>
      <ProfessionalList
        professionals={filteredProfessionals}
        events={filteredEvents}
      />
      <ProfessionManagerModal
        isOpen={isProfManagerOpen}
        onClose={() => setIsProfManagerOpen(false)}
        professions={dbData.professions}
        onDataUpdated={loadData}
      />
      {/* NOTIFICAÇÃO FLUTUANTE DE COMPARTILHAMENTO */}
      {shareFeedback && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#10b981', // Verde elegante
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          animation: 'fadeIn 0.3s ease-out',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {shareFeedback}
        </div>
      )}
      <RestScreen isActive={isResting} onWakeUp={() => setIsResting(false)} />
    </div>
  );
}