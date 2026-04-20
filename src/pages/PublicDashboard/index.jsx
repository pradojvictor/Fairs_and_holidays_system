// Arquivo: src/pages/PublicDashboard.jsx
import { useState, useEffect } from 'react';
import { fetchGistData } from '../../services/githubApi';
import './index.css';

export default function PublicDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [dbData, setDbData] = useState({ professionals: [], events: [], professions: [] });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  
  // === NOVOS ESTADOS PARA A GAVETA ===
  const [isExpanded, setIsExpanded] = useState(false);
  const [touchStartY, setTouchStartY] = useState(null);

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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getEventsForDay = (day) => {
    const target = new Date(year, month, day, 12, 0, 0);
    return dbData.events.filter(e => {
      const start = new Date(`${e.startDate}T12:00:00`);
      const end = new Date(`${e.endDate}T12:00:00`);
      return target >= start && target <= end;
    });
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  // === LÓGICA DE PUXAR A GAVETA ===
  const handleTouchStart = (e) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!touchStartY) return;
    
    const currentY = e.touches[0].clientY;
    const diff = touchStartY - currentY; // Positivo = puxou pra cima / Negativo = puxou pra baixo

    if (diff > 50) {
      setIsExpanded(true); // Expande se puxar pra cima
      setTouchStartY(null);
    } else if (diff < -50) {
      setIsExpanded(false); // Recolhe se puxar pra baixo
      setTouchStartY(null);
    }
  };

  const toggleDrawer = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="mobile-dash-container">
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
          {['D','S','T','Q','Q','S','S'].map(d => <div key={d} className="mobile-weekday">{d}</div>)}
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
                  setIsExpanded(false); // Sempre recolhe a gaveta ao trocar de dia para ver o calendário
                }}
              >
                <span>{day}</span>
                <div className="day-dots-container">
                  {eventsToday.slice(0, 3).map((e, i) => {
                    const pro = dbData.professionals.find(p => p.id === e.professionalId);
                    return <div key={i} className="dot" style={{ backgroundColor: pro?.baseColor }} />
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* GAVETA COM EVENTOS DE TOQUE */}
      <div 
        className={`mobile-half-drawer ${isExpanded ? 'expanded' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {/* O risquinho agora também pode ser clicado */}
        <div className="drawer-handle-wrapper" onClick={toggleDrawer}>
          <div className="drawer-handle"></div>
        </div>

        <div className="drawer-content">
          <h3 className="drawer-date-title">{selectedDay} de {monthName}</h3>
          
          <div className="compact-event-list">
            {selectedDayEvents.length === 0 ? (
              <p className="empty-msg">Ninguém de folga ou férias hoje.</p>
            ) : (
              selectedDayEvents.map(ev => {
                const pro = dbData.professionals.find(p => p.id === ev.professionalId);
                const cargo = dbData.professions.find(p => p.id === pro?.professionId)?.name || 'Geral';
                return (
                  <div key={ev.id} className="compact-row">
                    <div className="pro-color-bar" style={{ backgroundColor: pro?.baseColor }}></div>
                    <div className="pro-info-box">
                        <div className="pro-main-line">
                            <span className="pro-name">{pro?.name}</span>
                            <span className={`type-tag ${ev.type}`}>{ev.type === 'ferias' ? 'FÉRIAS' : 'FOLGA'}</span>
                        </div>
                        <div className="pro-sub-line">
                            {cargo} • {pro?.shift === 'dia_todo' ? 'Dia Todo' : pro?.shift}
                        </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}