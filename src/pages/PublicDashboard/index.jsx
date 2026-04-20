// Arquivo: src/pages/PublicDashboard.jsx
import { useState, useEffect } from 'react';
import { fetchGistData } from '../../services/githubApi';
import './index.css';

export default function PublicDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [dbData, setDbData] = useState({ professionals: [], events: [], professions: [] });
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [inputMatricula, setInputMatricula] = useState('');
  const [loginError, setLoginError] = useState('');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchGistData();
        setDbData({ 
          professionals: data.professionals || [], 
          events: data.events || [],
          professions: data.professions || []
        });
      } catch (err) { console.error(err); } 
      finally { setIsLoading(false); }
    };
    loadData();
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const user = dbData.professionals.find(p => p.matricula === inputMatricula.trim());
    
    if (user) {
      setLoggedInUser(user);
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Matrícula não encontrada. Verifique com o RH.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInUser(null);
    setInputMatricula('');
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
  const monthNameCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isSuper = loggedInUser?.isSupervisor === true;
  
  const myEvents = isSuper 
    ? dbData.events 
    : dbData.events.filter(e => e.professionalId === loggedInUser?.id);

  const getEventsForDay = (day) => {
    const target = new Date(year, month, day, 12, 0, 0);
    return myEvents.filter(e => {
      const start = new Date(`${e.startDate}T12:00:00`);
      const end = new Date(`${e.endDate}T12:00:00`);
      return target >= start && target <= end;
    });
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const currentMonthEvents = myEvents.filter(e => {
    const start = new Date(`${e.startDate}T12:00:00`);
    const end = new Date(`${e.endDate}T12:00:00`);
    const mStart = new Date(year, month, 1);
    const mEnd = new Date(year, month + 1, 0, 23, 59, 59);
    return start <= mEnd && end >= mStart;
  });
  currentMonthEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const currentYearEvents = myEvents.filter(e => {
    const startYear = new Date(`${e.startDate}T12:00:00`).getFullYear();
    const endYear = new Date(`${e.endDate}T12:00:00`).getFullYear();
    return startYear === year || endYear === year;
  });
  currentYearEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const formatPeriod = (startStr, endStr) => {
    if (!startStr || !endStr) return '';
    const start = new Date(`${startStr}T12:00:00`);
    const end = new Date(`${endStr}T12:00:00`);
    const sDay = String(start.getDate()).padStart(2, '0');
    const sMonth = String(start.getMonth() + 1).padStart(2, '0');
    const eDay = String(end.getDate()).padStart(2, '0');
    const eMonth = String(end.getMonth() + 1).padStart(2, '0');

    if (startStr === endStr) return `Apenas dia ${sDay}/${sMonth}`;
    const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0);
    const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0);
    if (start <= firstDayOfMonth && end >= lastDayOfMonth) return "O Mês Todo";
    return `De ${sDay}/${sMonth} até ${eDay}/${eMonth}`;
  };

  const formatAnnualPeriod = (startStr, endStr) => {
    if (!startStr || !endStr) return '';
    const start = new Date(`${startStr}T12:00:00`);
    const end = new Date(`${endStr}T12:00:00`);
    const sDay = String(start.getDate()).padStart(2, '0');
    const sMonth = String(start.getMonth() + 1).padStart(2, '0');
    const eDay = String(end.getDate()).padStart(2, '0');
    const eMonth = String(end.getMonth() + 1).padStart(2, '0');

    if (startStr === endStr) return `Dia ${sDay}/${sMonth}`;
    return `De ${sDay}/${sMonth} até ${eDay}/${eMonth}`;
  };

  if (isLoading) return <div className="mobile-dash-container loading-screen">Carregando...</div>;

  if (!isLoggedIn) {
    return (
      <div className="mobile-dash-container login-screen-container">
        <div className="login-card">
          <h2 className="login-title">Portal do Colaborador</h2>
          <p className="login-subtitle">Digite sua matrícula para ver sua escala.</p>
          <form onSubmit={handleLogin} className="login-form">
            <input 
              type="text" 
              placeholder="Número da Matrícula" 
              value={inputMatricula} 
              onChange={(e) => setInputMatricula(e.target.value)} 
              required 
              className="login-input" 
            />
            {loginError && <p className="login-error">{loginError}</p>}
            <button type="submit" className="login-btn">
              Acessar Escala
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-dash-container">
      
      <div className="user-profile-header">
        <div className="user-info-wrapper">
          <div className="user-avatar" style={{ backgroundColor: loggedInUser.baseColor }}>
            {loggedInUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="user-text-info">
            <span className="user-greeting">Olá, {isSuper && "👑 Supervisor"}</span>
            <span className="user-firstname">{loggedInUser.name.split(' ')[0]}</span>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-logout-mobile">Sair</button>
      </div>

      <div className="mobile-dash-header">
        <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>&lt;</button>
        <div className="mobile-header-title">
            <span className="month">{monthName.toUpperCase()}</span>
            <span className="year">{year}</span>
        </div>
        <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>&gt;</button>
      </div>

      <div className="mobile-calendar-section">
        <div className="mobile-calendar-grid">
          {['D','S','T','Q','Q','S','S'].map((d, index) => <div key={`day-${index}`} className="mobile-weekday">{d}</div>)}
          {blanks.map(b => <div key={`b-${b}`} className="mobile-day empty"></div>)}
          {days.map(day => {
            const eventsToday = getEventsForDay(day);
            const isSelected = selectedDay === day;
            return (
              <div 
                key={day} 
                className={`mobile-day ${isSelected ? 'selected' : ''}`} 
                onClick={() => { setSelectedDay(day); setIsExpanded(false); }}
              >
                <span>{day}</span>
                <div className="day-dots-container">
                  {eventsToday.slice(0, 3).map((e, i) => {
                    const pro = dbData.professionals.find(p => p.id === e.professionalId);
                    const dotColor = isSuper ? (pro?.baseColor || '#fff') : loggedInUser.baseColor;
                    return <div key={i} className="dot" style={{ backgroundColor: dotColor }} />
                  })}
                  {eventsToday.length > 3 && isSuper && <div className="dot-more">+</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mobile-half-drawer">
        <div className="drawer-header-clickable" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="drawer-handle"></div>
          <div className="drawer-title-row">
            <h3 className="drawer-date-title">{selectedDay} de {monthName}</h3>
            <button className="btn-expand-drawer">
              {isExpanded ? 'Ocultar ▲' : 'Ver Detalhes ▼'}
            </button>
          </div>
          {!isExpanded && (
             <p className="drawer-summary">
               {selectedDayEvents.length === 0 
                 ? (isSuper ? 'Ninguém de folga hoje.' : 'Você tem expediente normal hoje.')
                 : (isSuper ? `${selectedDayEvents.length} funcionário(s) ausente(s) hoje.` : `Você tem ${selectedDayEvents[0].type.toUpperCase()} registrada hoje!`)}
             </p>
          )}
        </div>

        {isExpanded && (
          <div className="drawer-content">
            
            {/* --- SEÇÃO 1: DIA SELECIONADO --- */}
            <h4 className="drawer-section-title">Neste dia ({selectedDay}):</h4>
            <div className="compact-event-list-spaced">
              {selectedDayEvents.length === 0 ? (
                <p className="empty-msg-drawer">{isSuper ? 'Equipe completa.' : 'Sem ausências agendadas. Dia normal de trabalho.'}</p>
              ) : (
                selectedDayEvents.map(ev => {
                  const pro = dbData.professionals.find(p => p.id === ev.professionalId) || loggedInUser;
                  const cargo = dbData.professions.find(p => p.id === pro.professionId)?.name || 'Geral';
                  return (
                    <div key={ev.id} className="compact-row dynamic-height">
                      <div className="pro-color-bar" style={{ backgroundColor: pro.baseColor }}></div>
                      <div className="pro-info-box">
                          <div className="pro-main-line">
                              <span className="pro-name">{isSuper ? pro.name : "Sua Escala"}</span>
                              <span className={`type-tag ${ev.type}`}>{ev.type === 'ferias' ? 'FÉRIAS' : 'FOLGA'}</span>
                          </div>
                          <div className="pro-sub-line">
                              {cargo} • {pro.shift === 'dia_todo' ? 'Dia Todo' : pro.shift}
                          </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* --- SEÇÃO 2: MÊS INTEIRO --- */}
            <h4 className="drawer-section-title">{isSuper ? `Visão da Equipe - ${monthNameCapitalized}` : `Minha Visão de ${monthNameCapitalized}:`}</h4>
            <div className="compact-event-list-spaced">
              {currentMonthEvents.length === 0 ? (
                <p className="empty-msg-drawer">Nenhuma folga ou férias programada para este mês.</p>
              ) : (
                currentMonthEvents.map(ev => {
                  const pro = dbData.professionals.find(p => p.id === ev.professionalId) || loggedInUser;
                  return (
                    <div key={`month-${ev.id}`} className="compact-row dynamic-height">
                      <div className="pro-color-bar" style={{ backgroundColor: pro.baseColor }}></div>
                      <div className="pro-info-box">
                          <div className="pro-main-line">
                              <span className="pro-name">{isSuper ? pro.name : "Ausência Agendada"}</span>
                              <span className={`type-tag ${ev.type}`}>{ev.type === 'ferias' ? 'FÉRIAS' : 'FOLGA'}</span>
                          </div>
                          <div className="pro-sub-line bold-dark">
                              {formatPeriod(ev.startDate, ev.endDate)}
                          </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* --- SEÇÃO 3: ANO INTEIRO --- */}
            <h4 className="drawer-section-title">{isSuper ? `Histórico Anual da Equipe (${year})` : `Meu Histórico Anual (${year}):`}</h4>
            <div className="compact-event-list">
              {currentYearEvents.length === 0 ? (
                <p className="empty-msg-drawer">Nenhum registro encontrado para este ano.</p>
              ) : (
                currentYearEvents.map(ev => {
                  const pro = dbData.professionals.find(p => p.id === ev.professionalId) || loggedInUser;
                  const isPast = new Date(`${ev.endDate}T23:59:59`) < new Date();
                  
                  return (
                    <div key={`year-${ev.id}`} className={`compact-row dynamic-height ${isPast ? 'past-event' : ''}`}>
                      <div className="pro-color-bar" style={{ backgroundColor: pro.baseColor }}></div>
                      <div className="pro-info-box">
                          <div className="pro-main-line">
                              <span className="pro-name">{isSuper ? pro.name : "Ausência"}</span>
                              <span className={`type-tag ${ev.type}`}>{ev.type === 'ferias' ? 'FÉRIAS' : 'FOLGA'}</span>
                          </div>
                          
                          <div className="pro-sub-line bold-dark">
                              {formatAnnualPeriod(ev.startDate, ev.endDate)}
                          </div>
                          
                          {ev.type === 'folga' && ev.reason && (
                              <div className="pro-reason-text">
                                  Motivo: {ev.reason}
                              </div>
                          )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}