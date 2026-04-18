// Arquivo: src/components/AnnualCalendar.jsx
import React from 'react';
import './index.css';

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// OLHA ELE AQUI: o onEventClick precisa estar aqui dentro das chaves!
export default function AnnualCalendar({ professionals = [], events = [], onEventClick }) {
  const currentYear = new Date().getFullYear();
  
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

  const getEventSpan = (startDateStr, endDateStr, monthIndex, year) => {
    if (!startDateStr || !endDateStr) return null;
    
    const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
    const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);

    const start = new Date(sYear, sMonth - 1, sDay, 12, 0, 0);
    const end = new Date(eYear, eMonth - 1, eDay, 12, 0, 0);
    const mStart = new Date(year, monthIndex, 1, 0, 0, 0);
    const mEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);

    if (start > mEnd || end < mStart) return null;

    const startDay = start < mStart ? 1 : start.getDate();
    const endDay = end > mEnd ? mEnd.getDate() : end.getDate();

    return { startDay, endDay };
  };

  return (
    <div className="calendar-container">
      
      {/* Grade de Meses */}
      <div className="months-wrapper">
        {meses.map((nomeMes, indexMes) => {
          const daysCount = getDaysInMonth(indexMes, currentYear);
          const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1);

          return (
            <div key={nomeMes} className="month-block">
              
              {/* Cabeçalho do Mês */}
              <div className="month-header">
                <strong className="month-title">{nomeMes} {currentYear}</strong>
                <div className="days-header-grid" style={{ gridTemplateColumns: `repeat(${daysCount}, 1fr)` }}>
                  {daysArray.map(day => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
              </div>

              {/* Corpo do Mês */}
              <div 
                className="month-body" 
                style={{ 
                  gridTemplateColumns: `repeat(${daysCount}, 1fr)`, 
                  gridTemplateRows: professionals.length > 0 ? `repeat(${professionals.length}, 16px)` : '16px'
                }}
              >
                {/* Linhas de fundo */}
                {daysArray.map(day => (
                  <div 
                    key={`bg-${day}`} 
                    className="day-separator"
                    style={{ gridColumn: day, gridRow: `1 / span ${Math.max(1, professionals.length)}` }} 
                  />
                ))}

                {/* Renderização dos Eventos */}
                {events.map((event, i) => {
                  const span = getEventSpan(event.startDate, event.endDate, indexMes, currentYear);
                  if (!span) return null; 

                  const proIndex = professionals.findIndex(p => p.id === event.professionalId);
                  if (proIndex === -1) return null;
                  const pro = professionals[proIndex];
                  
                  return (
                    <div 
                      key={`${event.id}-${indexMes}-${i}`}
                      className="event-line"
                      // A AÇÃO DE CLIQUE:
                      onClick={() => onEventClick && onEventClick(event)}
                      style={{
                        gridColumn: `${span.startDay} / ${span.endDay + 1}`,
                        gridRow: proIndex + 1, 
                        backgroundColor: pro.baseColor,
                        opacity: event.type === 'folga' ? 0.4 : 1, 
                      }}
                      title={`${pro.name} - ${event.type === 'folga' ? 'Folga' : 'Férias'}`} 
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="legend-container">
        <h4 className="legend-title">Legenda da Equipe</h4>
        <div className="legend-items">
          {professionals.length === 0 ? (
            <span className="empty-legend">Nenhum profissional cadastrado para exibir.</span>
          ) : (
            professionals.map(pro => (
              <div key={pro.id} className="legend-item">
                <div className="legend-circle" style={{ backgroundColor: pro.baseColor }}></div>
                <span className="legend-name">{pro.name}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}