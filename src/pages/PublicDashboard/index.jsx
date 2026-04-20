// Arquivo: src/pages/PublicDashboard.jsx
import { useState, useEffect } from 'react';
import { fetchGistData } from '../../services/githubApi';
import './index.css';

export default function PublicDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [dbData, setDbData] = useState({ professionals: [], events: [], professions: [] });
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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // 1. Pega os eventos só do dia selecionado
  const getEventsForDay = (day) => {
    const target = new Date(year, month, day, 12, 0, 0);
    return dbData.events.filter(e => {
      const start = new Date(`${e.startDate}T12:00:00`);
      const end = new Date(`${e.endDate}T12:00:00`);
      return target >= start && target <= end;
    });
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  // 2. NOVA LÓGICA: Pega os eventos do mês INTEIRO
  const currentMonthEvents = dbData.events.filter(e => {
    const start = new Date(`${e.startDate}T12:00:00`);
    const end = new Date(`${e.endDate}T12:00:00`);
    const mStart = new Date(year, month, 1);
    const mEnd = new Date(year, month + 1, 0, 23, 59, 59);
    return start <= mEnd && end >= mStart;
  });

  // Ordena os eventos do mês por data de início
  currentMonthEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  // Função para formatar a data (Ex: de "2024-05-15" para "15/05")
 // Função inteligente para formatar o texto da ausência
  const formatPeriod = (startStr, endStr) => {
    if (!startStr || !endStr) return '';
    
    const start = new Date(`${startStr}T12:00:00`);
    const end = new Date(`${endStr}T12:00:00`);
    
    const sDay = String(start.getDate()).padStart(2, '0');
    const sMonth = String(start.getMonth() + 1).padStart(2, '0');
    const eDay = String(end.getDate()).padStart(2, '0');
    const eMonth = String(end.getMonth() + 1).padStart(2, '0');

    // 1. É apenas um dia único de folga?
    if (startStr === endStr) {
      return `Apenas dia ${sDay}/${sMonth}`;
    }

    // 2. A ausência cobre o mês inteiro que estamos visualizando?
    const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0);
    const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0);
    
    if (start <= firstDayOfMonth && end >= lastDayOfMonth) {
      return "O Mês Todo";
    }

    // 3. É um período quebrado? (Ex: tirou 15 dias)
    return `De ${sDay}/${sMonth} até ${eDay}/${eMonth}`;
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
                 ? 'Ninguém de folga hoje. Equipe completa!' 
                 : `${selectedDayEvents.length} ausência(s) registrada(s) neste dia.`}
             </p>
          )}
        </div>

        {/* CONTEÚDO EXPANDIDO */}
        {isExpanded && (
          <div className="drawer-content">
            
            {/* SEÇÃO 1: DIA SELECIONADO */}
            <h4 style={{ fontSize: '0.9rem', color: '#6b7280', textTransform: 'uppercase', margin: '0 0 10px 0', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>
              Neste dia ({selectedDay}):
            </h4>
            
            <div className="compact-event-list" style={{ marginBottom: '25px' }}>
              {selectedDayEvents.length === 0 ? (
                <p className="empty-msg" style={{ margin: 0 }}>Nenhuma ausência agendada para hoje.</p>
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

            {/* SEÇÃO 2: MÊS INTEIRO */}
            <h4 style={{ fontSize: '0.9rem', color: '#6b7280', textTransform: 'uppercase', margin: '0 0 10px 0', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>
              Visão Geral do Mês:
            </h4>
            
            <div className="compact-event-list">
              {currentMonthEvents.length === 0 ? (
                <p className="empty-msg" style={{ margin: 0 }}>Ninguém de folga ou férias neste mês.</p>
              ) : (
                currentMonthEvents.map(ev => {
                  const pro = dbData.professionals.find(p => p.id === ev.professionalId);
                  const cargo = dbData.professions.find(p => p.id === pro?.professionId)?.name || 'Geral';
                  return (
                    <div key={`month-${ev.id}`} className="compact-row">
                      <div className="pro-color-bar" style={{ backgroundColor: pro?.baseColor }}></div>
                      <div className="pro-info-box">
                          <div className="pro-main-line">
                              <span className="pro-name">{pro?.name}</span>
                              <span className={`type-tag ${ev.type}`}>{ev.type === 'ferias' ? 'FÉRIAS' : 'FOLGA'}</span>
                          </div>
                          <div className="pro-sub-line" style={{ fontWeight: 'bold', color: '#4b5563' }}>
                              {formatPeriod(ev.startDate, ev.endDate)}
                          </div>
                          <div className="pro-sub-line" style={{ fontSize: '0.75rem' }}>
                              {cargo} • {pro?.shift === 'dia_todo' ? 'Dia Todo' : pro?.shift}
                          </div>
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