import React, { useState, useEffect, useRef } from 'react';
import './index.css';

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function AnnualCalendar({ professionals = [], events = [], onEventClick }) {
  const currentYear = new Date().getFullYear();
  const [holidays, setHolidays] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  const sliderRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${currentYear}`);
        if (!response.ok) throw new Error('Erro na API de Feriados');
        const data = await response.json();
        setHolidays(data);
      } catch (error) {
        console.error("Não foi possível carregar os feriados:", error);
      }
    };
    fetchHolidays();
  }, [currentYear]);

  useEffect(() => {
    if (sliderRef.current && !isExpanded) {
      const currentMonthIndex = new Date().getMonth();
      const monthElement = sliderRef.current.children[currentMonthIndex];
      if (monthElement) {
        setTimeout(() => {
          monthElement.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
        }, 300);
      }
    }
  }, [isExpanded]);

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

  const getHolidayForDay = (monthIndex, day) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateString = `${currentYear}-${m}-${d}`;
    return holidays.find(h => h.date === dateString);
  };

  const handleMouseDown = (e) => {
    if (isExpanded) return;
    setIsDragging(true);
    setStartX(e.pageX - sliderRef.current.offsetLeft);
    setScrollLeft(sliderRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || isExpanded) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    sliderRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div className="calendar-container">

      <div className="calendar-drawer-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3 className="calendar-drawer-title">Escala Anual <strong>{currentYear}</strong></h3>
        <button className="btn-toggle-calendar">
          {isExpanded ? 'Ver Menos ▲' : 'Expandir Ano Completo ▼'}
        </button>
      </div>

      <div
        className={`months-wrapper ${isExpanded ? 'expanded' : 'slider'} ${isDragging ? 'dragging' : ''}`}
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {meses.map((nomeMes, indexMes) => {
          const daysCount = getDaysInMonth(indexMes, currentYear);
          const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1);
          return (
            <div key={nomeMes} className="month-block">
              <div className="month-header">
                <strong className="month-title">{nomeMes} {currentYear}</strong>
                <div className="days-header-grid" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))` }}>
                  {daysArray.map(day => {
                    const holiday = getHolidayForDay(indexMes, day);
                    return (
                      <div
                        key={day}
                        className={holiday ? 'holiday-day' : ''}
                        title={holiday ? holiday.name : ''}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div
                className="month-body"
                style={{
                  gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))`,
                  gridTemplateRows: professionals.length > 0 ? `repeat(${professionals.length}, 5px)` : '5px'
                }}
              >
                {daysArray.map(day => (
                  <div
                    key={`bg-${day}`}
                    className="day-separator"
                    style={{ gridColumn: day, gridRow: `1 / span ${Math.max(1, professionals.length)}` }}
                  />
                ))}
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

      <div className={`legend-drawer-wrapper ${isLegendExpanded ? 'expanded' : ''}`}>
        <div className="legend-drawer-header" onClick={() => setIsLegendExpanded(!isLegendExpanded)}>
          <h4 className="legend-drawer-title">
            Legenda da Equipe ({professionals.length} profissionais)
          </h4>
          <div className="legend-drawer-actions">
            {!isLegendExpanded && (
              <div className="legend-preview-dots">
                {professionals.slice(0, 8).map(p => (
                  <div key={p.id} className="preview-dot" style={{ backgroundColor: p.baseColor }} />
                ))}
                {professionals.length > 8 && <span className="preview-more">+</span>}
              </div>
            )}
            <span className="toggle-icon">{isLegendExpanded ? '▲' : '▼'}</span>
          </div>
        </div>

        <div className="legend-drawer-content">
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
    </div>
  );
}