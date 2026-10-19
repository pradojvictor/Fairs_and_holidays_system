import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGistData, fetchNotifications, runOperation } from '../../services/githubApi';
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
import FeriasPendentesModal from '../../components/FeriasPendentesModal';
import Sino from '../../components/Notificacoes/Sino';
import CentralNotificacoes from '../../components/Notificacoes/Central';
import DetalheNotificacao from '../../components/Notificacoes/Detalhe';
import { aplicarLidas, importantesNaoVistas, lerLidas, marcarLidas, salvarLidas } from '../../components/Notificacoes/lidas';
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
  const [adminData, setAdminData] = useState({ username: 'Administrador' });

  const [eventToDelete, setEventToDelete] = useState(null);

  const [shareFeedback, setShareFeedback] = useState('');

  const [isResting, setIsResting] = useState(false);

  // Férias por tempo de serviço que o operador ainda precisa confirmar (calculadas no servidor).
  // O aviso chega pelo sino; a janela de lançamento abre pela ação da notificação.
  const [pendenciasFerias, setPendenciasFerias] = useState([]);
  const [isFeriasModalOpen, setIsFeriasModalOpen] = useState(false);

  // Central de notificações (api/notificacoes.js). O servidor manda a lista; o que já foi lido
  // fica neste navegador (Notificacoes/lidas.js), por computador.
  const [notificacoesServidor, setNotificacoesServidor] = useState([]);
  const [lidas, setLidas] = useState(() => lerLidas());
  const notificacoes = aplicarLidas(notificacoesServidor, lidas);
  const [notificacaoAberta, setNotificacaoAberta] = useState(null);
  const [centralAberta, setCentralAberta] = useState(false);
  const [novasAoAbrirCentral, setNovasAoAbrirCentral] = useState([]);

  // Atualizações importantes que este computador ainda não viu: abrem sozinhas, uma de cada
  // vez, na primeira carga do painel (ver Notificacoes/lidas.js).
  const [filaImportantes, setFilaImportantes] = useState([]);
  const [totalImportantes, setTotalImportantes] = useState(0);
  const importantesVerificadas = useRef(false);

  // As notificações não seguram o painel: se falharem, o resto continua funcionando.
  const loadNotificacoes = async () => {
    try {
      const resposta = await fetchNotifications();
      const lista = resposta.notificacoes || [];
      setNotificacoesServidor(lista);
      if (!importantesVerificadas.current) {
        importantesVerificadas.current = true;
        const fila = importantesNaoVistas(aplicarLidas(lista, lerLidas()));
        setFilaImportantes(fila);
        setTotalImportantes(fila.length);
      }
    } catch (err) {
      if (err.status === 401) navigate('/login', { replace: true });
      else console.error('Notificações indisponíveis:', err);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchGistData();
      if (data.perfil?.papel !== 'admin') {
        navigate('/login', { replace: true });
        return;
      }
      setDbData({ professionals: data.professionals || [], events: data.events || [], professions: data.professions || [] });
      setAdminData({ username: data.perfil.username });
      setPendenciasFerias(data.pendenciasFerias || []);
      loadNotificacoes();
    } catch (err) {
      if (err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setError('Erro ao carregar os dados.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const marcarComoLidas = (ids) => {
    if (!ids.length) return;
    const novas = marcarLidas(lidas, ids, new Set(notificacoesServidor.map(n => n.id)));
    salvarLidas(novas);
    setLidas(novas);
  };

  // Clicar numa notificação marca como lida (neste computador) e abre o detalhe.
  const abrirNotificacao = (n) => {
    setNotificacaoAberta(n);
    if (!n.lida) marcarComoLidas([n.id]);
  };

  // "Ver todas" tira tudo da lista do sino e abre a central; as que eram novas seguem destacadas.
  const verTodasNotificacoes = () => {
    const novas = notificacoes.filter(n => !n.lida).map(n => n.id);
    setNovasAoAbrirCentral(novas);
    setCentralAberta(true);
    marcarComoLidas(novas);
  };

  // Fechar o pop-up (por "Entendi", X ou Esc) conta como visto neste computador.
  const fecharImportante = () => {
    marcarComoLidas([filaImportantes[0].id]);
    setFilaImportantes(filaImportantes.slice(1));
  };

  // Quem lançou (ou dispensou) as férias não precisa ser avisado do próprio lançamento: o
  // registro entra como lido aqui e aparece como novo nos outros computadores.
  const feriasResolvidas = (pendencia, acao) => {
    marcarComoLidas([`${acao === 'lancar' ? 'ferias-lancada' : 'ferias-dispensada'}:${pendencia.professionalId}:${pendencia.aniversario}`]);
  };

  const agirNotificacao = (n) => {
    setNotificacaoAberta(null);
    setCentralAberta(false);
    if (n.acao?.tipo === 'lancar-ferias') setIsFeriasModalOpen(true);
    if (n.acao?.tipo === 'banco-ferias') setIsBankSidebarOpen(true);
    if (n.acao?.tipo === 'ver-escala') {
      setFilterProf(n.professionalId || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
      // O servidor tira o evento e o desconto ligado a ele (log_<id>) dos bancos.
      await runOperation('evento.excluir', { id: String(eventToDelete) });

      setSelectedEvent(null);
      setEventToDelete(null);
      await loadData();

    } catch (err) {
      console.error("Falha ao deletar evento:", err);
      alert(err.message || "Erro ao remover o evento. Verifique sua conexão.");
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
          <button className="btn-new-event" onClick={handleOpenNewEvent}>Nova Ausência</button>

        </div>

        <div className="header-actions">
          <h2 className="dashboard-title">controle de férias e folgas</h2>
        </div>
        <div className="header-right">
          <Sino notificacoes={notificacoes} onAbrir={abrirNotificacao} onVerTodas={verTodasNotificacoes} />
          <button className="btn-pause" onClick={() => setIsResting(true)}>Pausar Sistema</button>
        </div>
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
                <div className="filter-group filter-group-type" >
                  <label>Filtrar Tipo:</label>
                  <CustomSelect
                    value={filterType}
                    onChange={setFilterType}
                    options={[
                      { value: '', label: 'Todos' },
                      { value: 'ferias', label: 'Apenas Férias' },
                      { value: 'folga', label: 'Apenas Folgas' },
                      { value: 'atestado', label: 'Apenas Atestados' } // <- ADD ISTO
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
      <FeriasPendentesModal
        isOpen={isFeriasModalOpen}
        onClose={() => setIsFeriasModalOpen(false)}
        pendencias={pendenciasFerias}
        professionals={dbData.professionals}
        onDataUpdated={loadData}
        onResolvido={feriasResolvidas}
      />
      {centralAberta && (
        <CentralNotificacoes
          notificacoes={notificacoes.map(n => (novasAoAbrirCentral.includes(n.id) ? { ...n, lida: false } : n))}
          onFechar={() => setCentralAberta(false)}
          onAbrir={abrirNotificacao}
        />
      )}
      <DetalheNotificacao
        notificacao={notificacaoAberta}
        onFechar={() => setNotificacaoAberta(null)}
        onAcao={agirNotificacao}
      />
      {!notificacaoAberta && filaImportantes.length > 0 && (
        <DetalheNotificacao
          notificacao={filaImportantes[0]}
          progresso={{ atual: totalImportantes - filaImportantes.length + 1, total: totalImportantes }}
          onFechar={fecharImportante}
        />
      )}
      <RestScreen isActive={isResting} onWakeUp={() => setIsResting(false)} />
    </div>
  );
}