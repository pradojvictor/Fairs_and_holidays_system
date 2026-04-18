// Arquivo: src/components/MonthlySummary.jsx
import React, { useState } from 'react';
import './index.css';

export default function MonthlySummary({ professionals = [], events = [] }) {
  // A MÁGICA: Agora a data base é um estado mutável, começando no dia atual
  const [baseDate, setBaseDate] = useState(new Date());

  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth(); // 0 a 11
  const monthName = baseDate.toLocaleString('pt-BR', { month: 'long' });
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0=Dom, 6=Sáb

  // Funções de Navegação
  const handlePrevMonth = () => setBaseDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setBaseDate(new Date(currentYear, currentMonth + 1, 1));
  const handleToday = () => setBaseDate(new Date());

  // Filtra eventos do mês selecionado na tela
  const currentMonthEvents = events.filter(e => {
    const start = new Date(`${e.startDate}T12:00:00`);
    const end = new Date(`${e.endDate}T12:00:00`);
    const mStart = new Date(currentYear, currentMonth, 1);
    const mEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return start <= mEnd && end >= mStart;
  });

  const feriasCount = currentMonthEvents.filter(e => e.type === 'ferias').length;
  const folgasCount = currentMonthEvents.filter(e => e.type === 'folga').length;

  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Para saber se o quadradinho é o dia de "hoje" real
  const realToday = new Date();
  const isRealCurrentMonth = realToday.getFullYear() === currentYear && realToday.getMonth() === currentMonth;

  return (
    <div className="summary-container">
      
      {/* LADO ESQUERDO: Calendário Mensal */}
      <div className="mini-calendar-card">
        
        {/* CONTROLES DE NAVEGAÇÃO */}
        <div className="month-navigation">
          <button onClick={handlePrevMonth} className="btn-nav-month" title="Mês Anterior">&lt;</button>
          
          <div className="month-nav-title">
            <strong>{monthName} {currentYear}</strong>
            {!isRealCurrentMonth && (
              <button onClick={handleToday} className="btn-today">Voltar para Hoje</button>
            )}
          </div>
          
          <button onClick={handleNextMonth} className="btn-nav-month" title="Próximo Mês">&gt;</button>
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

      {/* LADO DIREITO: Indicadores do Mês (Atualizam automaticamente!) */}
      <div className="indicators-card">
        <h3 style={{ margin: 0, color: '#111827', fontSize: '1.2rem', textTransform: 'capitalize' }}>
          Resumo de {monthName}
        </h3>
        
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

        <div className="absent-list">
          <h4>Profissionais Ausentes neste mês:</h4>
          {currentMonthEvents.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Nenhuma ausência registrada para {monthName}.</p>
          ) : (
            <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.9rem', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {currentMonthEvents.map(e => {
                const pro = professionals.find(p => p.id === e.professionalId);
                return (
                  <li key={e.id}>
                    <strong>{pro?.name || 'Desconhecido'}</strong> 
                    <span style={{ color: '#9ca3af', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                      ({e.type === 'folga' ? 'Folga' : 'Férias'})
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

    </div>
  );
}