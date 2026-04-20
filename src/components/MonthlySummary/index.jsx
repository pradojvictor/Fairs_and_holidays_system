// Arquivo: src/components/MonthlySummary.jsx
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

  // 1. EVENTOS DO MÊS ATUAL
  const currentMonthEvents = events.filter(e => {
    const start = new Date(`${e.startDate}T12:00:00`);
    const end = new Date(`${e.endDate}T12:00:00`);
    const mStart = new Date(currentYear, currentMonth, 1);
    const mEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return start <= mEnd && end >= mStart;
  });

  // Ordena por data de início
  currentMonthEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  // 2. EVENTOS ESPECÍFICOS DE "HOJE"
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

  // Função Inteligente de Datas
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

  // Análise de Impacto Operacional
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

  const exportToCSV = () => {
    if (currentMonthEvents.length === 0) {
      alert("Não há ausências para exportar neste mês.");
      return;
    }
    let csvContent = "Profissional;Cargo;Turno;Tipo;Data Inicio;Data Fim;Motivo\n";
    currentMonthEvents.forEach(e => {
      const pro = professionals.find(p => p.id === e.professionalId);
      const name = pro ? pro.name.replace(/;/g, ",") : 'Desconhecido';
      const cargo = professions.find(p => p.id === pro?.professionId)?.name || '-';
      const shift = pro?.shift === 'dia_todo' ? 'Dia Todo' : (pro?.shift || '-');
      const type = e.type === 'folga' ? 'Folga' : 'Férias';
      const start = new Date(`${e.startDate}T12:00:00`).toLocaleDateString('pt-BR');
      const end = new Date(`${e.endDate}T12:00:00`).toLocaleDateString('pt-BR');
      const reason = e.reason ? e.reason.replace(/;/g, ",") : '-';
      csvContent += `${name};${cargo};${shift};${type};${start};${end};${reason}\n`;
    });
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Ausencias_${monthName}_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="summary-container">
      
      {/* LADO ESQUERDO: Calendário Mensal */}
      <div className="mini-calendar-card">
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

      {/* LADO DIREITO: Indicadores e Listas */}
      <div className="indicators-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* CABEÇALHO E NÚMEROS */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#111827', fontSize: '1.2rem', textTransform: 'capitalize' }}>
              Resumo de {monthName}
            </h3>
            <button onClick={exportToCSV} className="btn-export">⬇️ Exportar CSV</button>
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

        {/* LISTAS INTELIGENTES */}
        <div className="absent-list" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* SEÇÃO 1: HOJE */}
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

          {/* SEÇÃO 2: VISÃO GERAL DO MÊS */}
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

        </div>

        {/* IMPACTO OPERACIONAL (Fica no final) */}
        {impactKeys.length > 0 && (
          <div className="impact-box">
            <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '0.95rem' }}>📊 Impacto Operacional no Mês</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {impactKeys.map(key => {
                const data = impactReport[key];
                const isWarning = data.total >= 2; 
                return (
                  <div key={key} className="impact-row" style={{ borderLeftColor: isWarning ? '#f59e0b' : '#10b981' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="impact-title">
                        {isWarning && <span title="Atenção">⚠️ </span>}
                        {key.split('|')[0]}
                      </span>
                      <span className="impact-shift">{key.split('|')[1]}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="impact-total" style={{ color: isWarning ? '#b45309' : '#047857' }}>
                        {data.total} ausência{data.total > 1 ? 's' : ''}
                      </span>
                      <div className="impact-details">({data.ferias} Férias, {data.folgas} Folgas)</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}