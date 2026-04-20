// Arquivo: src/pages/PublicDashboard.jsx
import { useState, useEffect } from 'react';
import { fetchGistData } from '../../services/githubApi';
import './index.css';

export default function PublicDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [dbData, setDbData] = useState({ professionals: [], events: [], professions: [] });
  
  // === NOVOS ESTADOS DE LOGIN ===
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

  // === LÓGICA DE LOGIN ===
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

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // === A MÁGICA DO FILTRO PRIVADO ===
  // Agora o sistema SÓ olha para as férias/folgas do usuário que fez login!
  const myEvents = dbData.events.filter(e => e.professionalId === loggedInUser?.id);

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

  // === TELA DE CARREGAMENTO ===
  if (isLoading) {
    return <div className="mobile-dash-container" style={{justifyContent: 'center', alignItems: 'center'}}>Carregando...</div>;
  }

  // === TELA DE LOGIN (Se não estiver logado) ===
  if (!isLoggedIn) {
    return (
      <div className="mobile-dash-container login-screen" style={{ justifyContent: 'center', padding: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', color: '#111827', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.5rem' }}>Portal do Colaborador</h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '25px' }}>Digite sua matrícula para ver sua escala.</p>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="text" 
              placeholder="Número da Matrícula" 
              value={inputMatricula}
              onChange={(e) => setInputMatricula(e.target.value)}
              required
              style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem', textAlign: 'center' }}
            />
            
            {loginError && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0' }}>{loginError}</p>}
            
            <button type="submit" style={{ backgroundColor: '#ff2d95', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
              Acessar Minha Escala
            </button>
          </form>
        </div>
      </div>
    );
  }

  // === TELA DO DASHBOARD (Quando Logado) ===
  return (
    <div className="mobile-dash-container">
      
      {/* NOVO HEADER COM NOME E BOTÃO DE SAIR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 20px 0 20px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '35px', height: '35px', borderRadius: '50%', backgroundColor: loggedInUser.baseColor, display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: 'white', fontSize: '1.2rem' }}>
            {loggedInUser.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Olá,</span>
            <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{loggedInUser.name.split(' ')[0]}</span>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer' }}>
          Sair
        </button>
      </div>

      <div className="mobile-dash-header" style={{ paddingTop: '15px' }}>
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
                onClick={() => {
                  setSelectedDay(day);
                  setIsExpanded(false);
                }}
              >
                <span>{day}</span>
                <div className="day-dots-container">
                  {eventsToday.slice(0, 3).map((e, i) => (
                    <div key={i} className="dot" style={{ backgroundColor: loggedInUser.baseColor }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* GAVETA (CONTROLE POR BOTÃO) */}
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
                 ? 'Você tem expediente normal hoje.' 
                 : `Você tem ${selectedDayEvents[0].type.toUpperCase()} registrada hoje!`}
             </p>
          )}
        </div>

        {isExpanded && (
          <div className="drawer-content">
            
            <h4 style={{ fontSize: '0.9rem', color: '#6b7280', textTransform: 'uppercase', margin: '0 0 10px 0', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>
              Neste dia ({selectedDay}):
            </h4>
            
            <div className="compact-event-list" style={{ marginBottom: '25px' }}>
              {selectedDayEvents.length === 0 ? (
                <p className="empty-msg" style={{ margin: 0 }}>Sem ausências agendadas. Dia normal de trabalho.</p>
              ) : (
                selectedDayEvents.map(ev => {
                  const cargo = dbData.professions.find(p => p.id === loggedInUser.professionId)?.name || 'Geral';
                  return (
                    <div key={ev.id} className="compact-row">
                      <div className="pro-color-bar" style={{ backgroundColor: loggedInUser.baseColor }}></div>
                      <div className="pro-info-box">
                          <div className="pro-main-line">
                              <span className="pro-name">Sua Escala</span>
                              <span className={`type-tag ${ev.type}`}>{ev.type === 'ferias' ? 'FÉRIAS' : 'FOLGA'}</span>
                          </div>
                          <div className="pro-sub-line">
                              {cargo} • {loggedInUser.shift === 'dia_todo' ? 'Dia Todo' : loggedInUser.shift}
                          </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <h4 style={{ fontSize: '0.9rem', color: '#6b7280', textTransform: 'uppercase', margin: '0 0 10px 0', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>
              Minha Visão Geral de {monthNameCapitalized}:
            </h4>
            
            <div className="compact-event-list">
              {currentMonthEvents.length === 0 ? (
                <p className="empty-msg" style={{ margin: 0 }}>Você não tem folgas ou férias programadas para este mês.</p>
              ) : (
                currentMonthEvents.map(ev => (
                  <div key={`month-${ev.id}`} className="compact-row">
                    <div className="pro-color-bar" style={{ backgroundColor: loggedInUser.baseColor }}></div>
                    <div className="pro-info-box">
                        <div className="pro-main-line">
                            <span className="pro-name">Ausência Agendada</span>
                            <span className={`type-tag ${ev.type}`}>{ev.type === 'ferias' ? 'FÉRIAS' : 'FOLGA'}</span>
                        </div>
                        <div className="pro-sub-line" style={{ fontWeight: 'bold', color: '#4b5563' }}>
                            {formatPeriod(ev.startDate, ev.endDate)}
                        </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}