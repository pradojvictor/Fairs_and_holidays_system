import React, { useState } from 'react';
import './index.css';

export default function MonthlySummary({ professionals = [], events = [], professions = [] }) {
  const [baseDate, setBaseDate] = useState(new Date());

  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth();
  const monthName = baseDate.toLocaleString('pt-BR', { month: 'long' });
  const monthNameCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => setBaseDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setBaseDate(new Date(currentYear, currentMonth + 1, 1));
  const handleToday = () => setBaseDate(new Date());

  const realToday = new Date();
  const isRealCurrentMonth = realToday.getFullYear() === currentYear && realToday.getMonth() === currentMonth;

  const currentMonthEvents = events.filter(e => {
    const start = new Date(`${e.startDate}T12:00:00`);
    const end = new Date(`${e.endDate}T12:00:00`);
    const mStart = new Date(currentYear, currentMonth, 1);
    const mEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return start <= mEnd && end >= mStart;
  });

  currentMonthEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const todayTarget = new Date(realToday.getFullYear(), realToday.getMonth(), realToday.getDate(), 12, 0, 0);
  const todayEvents = events.filter(e => {
    const start = new Date(`${e.startDate}T12:00:00`);
    const end = new Date(`${e.endDate}T12:00:00`);
    return todayTarget >= start && todayTarget <= end;
  });

  const feriasCount = currentMonthEvents.filter(e => e.type === 'ferias').length;
  const folgasCount = currentMonthEvents.filter(e => e.type === 'folga').length;

  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const formatPeriod = (startStr, endStr) => {
    if (!startStr || !endStr) return '';
    const start = new Date(`${startStr}T12:00:00`);
    const end = new Date(`${endStr}T12:00:00`);

    const sDay = String(start.getDate()).padStart(2, '0');
    const sMonth = String(start.getMonth() + 1).padStart(2, '0');
    const eDay = String(end.getDate()).padStart(2, '0');
    const eMonth = String(end.getMonth() + 1).padStart(2, '0');

    if (startStr === endStr) return `Apenas dia ${sDay}/${sMonth}`;

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1, 12, 0, 0);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0, 12, 0, 0);

    if (start <= firstDayOfMonth && end >= lastDayOfMonth) return "O Mês Todo";
    return `De ${sDay}/${sMonth} até ${eDay}/${eMonth}`;
  };

  const generateImpactReport = () => {
    const report = {};
    currentMonthEvents.forEach(e => {
      const pro = professionals.find(p => p.id === e.professionalId);
      if (!pro) return;
      const cargo = professions.find(p => p.id === pro.professionId)?.name || 'Sem Cargo Definido';

      let turnoFormatado = pro.shift;
      if (turnoFormatado === 'dia_todo') turnoFormatado = 'Dia Todo';
      if (turnoFormatado === 'manhã' || turnoFormatado === 'manha') turnoFormatado = 'Manhã';
      if (turnoFormatado === 'tarde') turnoFormatado = 'Tarde';

      const key = `${cargo} | Turno: ${turnoFormatado}`;
      if (!report[key]) report[key] = { total: 0, ferias: 0, folgas: 0 };

      report[key].total += 1;
      if (e.type === 'ferias') report[key].ferias += 1;
      if (e.type === 'folga') report[key].folgas += 1;
    });
    return report;
  };

  const impactReport = generateImpactReport();
  const impactKeys = Object.keys(impactReport);

  return (
    <div className="summary-container">
      <div className="mini-calendar-card">
        <div className="month-navigation">
          <button onClick={handlePrevMonth} className="btn-nav-month" title="Mês Anterior">
            <svg clipRule="evenodd" fillRule="evenodd" strokeLinejoin="round" strokeMiterlimit="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m13.789 7.155c.141-.108.3-.157.456-.157.389 0 .755.306.755.749v8.501c0 .445-.367.75-.755.75-.157 0-.316-.05-.457-.159-1.554-1.203-4.199-3.252-5.498-4.258-.184-.142-.29-.36-.29-.592 0-.23.107-.449.291-.591 1.299-1.002 3.945-3.044 5.498-4.243z" /></svg>
          </button>
          <div className="month-nav-title">
            <strong>{monthName} {currentYear}</strong>
            {!isRealCurrentMonth && (
              <button onClick={handleToday} className="btn-today">Voltar para Hoje</button>
            )}
          </div>
          <button onClick={handleNextMonth} className="btn-nav-month" title="Próximo Mês">
            <svg clipRule="evenodd" fillRule="evenodd" strokeLinejoin="round" strokeMiterlimit="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m10.211 7.155c-.141-.108-.3-.157-.456-.157-.389 0-.755.306-.755.749v8.501c0 .445.367.75.755.75.157 0 .316-.05.457-.159 1.554-1.203 4.199-3.252 5.498-4.258.184-.142.29-.36.29-.592 0-.23-.107-.449-.291-.591-1.299-1.002-3.945-3.044-5.498-4.243z" /></svg>
          </button>
        </div>

        <div className="mini-calendar-grid">
          {weekDays.map(d => <div key={d} className="mini-day-name">{d}</div>)}
          {blanks.map(b => <div key={`blank-${b}`} className="mini-day-cell empty"></div>)}
          {days.map(day => {
            const isToday = isRealCurrentMonth && day === realToday.getDate();
            const eventsToday = currentMonthEvents.filter(e => {
              const start = new Date(`${e.startDate}T12:00:00`);
              const end = new Date(`${e.endDate}T12:00:00`);
              const current = new Date(currentYear, currentMonth, day, 12, 0, 0);
              return current >= start && current <= end;
            });
            return (
              <div key={day} className={`mini-day-cell ${isToday ? 'today' : ''}`}>
                <span>{day}</span>
                <div className="day-dots">
                  {eventsToday.map((e, i) => {
                    const pro = professionals.find(p => p.id === e.professionalId);
                    if (!pro) return null;
                    return <div key={i} className="day-dot" style={{ backgroundColor: pro.baseColor, opacity: e.type === 'folga' ? 0.5 : 1 }} title={pro.name} />
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="indicators-card">
        <div className="summary-header-area">
          <div className="summary-header-top">
            <h3 className="summary-title">
              Resumo de {monthName}
            </h3>
          </div>

          <div className="indicator-row">
            <div className="indicator-box ferias">
              <span className="ind-number">{feriasCount}</span>
              <span className="ind-label">Férias</span>
            </div>
            <div className="indicator-box folgas">
              <span className="ind-number">{folgasCount}</span>
              <span className="ind-label">Folgas</span>
            </div>
          </div>
        </div>

        <div className="absent-list">

          <div>
            <h4 className="section-header">📅 Hoje ({realToday.toLocaleDateString('pt-BR').slice(0, 5)})</h4>
            <div className="compact-event-list">
              {todayEvents.length === 0 ? (
                <p className="empty-msg-admin">Equipe completa hoje! Nenhuma ausência.</p>
              ) : (
                todayEvents.map(e => {
                  const pro = professionals.find(p => p.id === e.professionalId);
                  const cargo = professions.find(p => p.id === pro?.professionId)?.name || 'Sem cargo';
                  const shift = pro?.shift === 'dia_todo' ? 'Dia Todo' : (pro?.shift || '-');
                  return (
                    <div key={`today-${e.id}`} className="admin-compact-row">
                      <div className="admin-pro-color" style={{ backgroundColor: pro?.baseColor || '#ccc' }}></div>
                      <div className="admin-pro-info">
                        <div className="admin-pro-main">
                          <span className="admin-pro-name">{pro?.name || 'Desconhecido'}</span>
                          <span className={`admin-tag ${e.type}`}>{e.type === 'ferias' ? 'FÉRIAS' : 'FOLGA'}</span>
                        </div>
                        <div className="admin-pro-sub">{cargo} • {shift}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <h4 className="section-header">🗓️ Visão Geral de {monthNameCapitalized}</h4>
            <div className="compact-event-list">
              {currentMonthEvents.length === 0 ? (
                <p className="empty-msg-admin">Nenhuma ausência agendada para este mês.</p>
              ) : (
                currentMonthEvents.map(e => {
                  const pro = professionals.find(p => p.id === e.professionalId);
                  const cargo = professions.find(p => p.id === pro?.professionId)?.name || 'Sem cargo';
                  const shift = pro?.shift === 'dia_todo' ? 'Dia Todo' : (pro?.shift || '-');
                  return (
                    <div key={`month-${e.id}`} className="admin-compact-row">
                      <div className="admin-pro-color" style={{ backgroundColor: pro?.baseColor || '#ccc' }}></div>
                      <div className="admin-pro-info">
                        <div className="admin-pro-main">
                          <span className="admin-pro-name">{pro?.name || 'Desconhecido'}</span>
                          <span className={`admin-tag ${e.type}`}>{e.type === 'ferias' ? 'FÉRIAS' : 'FOLGA'}</span>
                        </div>
                        <div className="admin-pro-sub" style={{ fontWeight: 'bold', color: '#374151', marginBottom: '2px' }}>
                          {formatPeriod(e.startDate, e.endDate)}
                        </div>
                        <div className="admin-pro-sub" style={{ fontSize: '0.75rem' }}>{cargo} • {shift}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {impactKeys.length > 0 && (
            <div className="impact-box impact-box-no-margin">
              <h4 className="impact-box-title">📊 Impacto Operacional no Mês</h4>

              <div className="impact-list">
                {impactKeys.map(key => {
                  const data = impactReport[key];
                  const isWarning = data.total >= 2;

                  return (
                    <div key={key} className={`impact-row ${isWarning ? 'status-warning' : 'status-safe'}`}>
                      <div className="impact-row-left">
                        <span className="impact-title">
                          {isWarning && <span title="Atenção">⚠️ </span>}
                          {key.split('|')[0]}
                        </span>
                        <span className="impact-shift">{key.split('|')[1]}</span>
                      </div>

                      <div className="impact-row-right">
                        <span className={`impact-total ${isWarning ? 'text-warning' : 'text-safe'}`}>
                          {data.total} ausência{data.total > 1 ? 's' : ''}
                        </span>
                        <div className="impact-details">
                          ({data.ferias} Férias, {data.folgas} Folgas)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}