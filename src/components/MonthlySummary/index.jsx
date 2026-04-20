// Arquivo: src/components/MonthlySummary.jsx
import React, { useState } from 'react';
import './index.css';

// ATENÇÃO: Adicionamos "professions" aqui nos parâmetros!
export default function MonthlySummary({ professionals = [], events = [], professions = [] }) {
  const [baseDate, setBaseDate] = useState(new Date());

  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth();
  const monthName = baseDate.toLocaleString('pt-BR', { month: 'long' });
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => setBaseDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setBaseDate(new Date(currentYear, currentMonth + 1, 1));
  const handleToday = () => setBaseDate(new Date());

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

  const realToday = new Date();
  const isRealCurrentMonth = realToday.getFullYear() === currentYear && realToday.getMonth() === currentMonth;

  // === NOVO: ANÁLISE DE IMPACTO OPERACIONAL ===
  const generateImpactReport = () => {
    const report = {};

    currentMonthEvents.forEach(e => {
      const pro = professionals.find(p => p.id === e.professionalId);
      if (!pro) return;

      const cargo = professions.find(p => p.id === pro.professionId)?.name || 'Sem Cargo Definido';
      
      // Formata o turno para ficar bonito
      let turnoFormatado = pro.shift;
      if (turnoFormatado === 'dia_todo') turnoFormatado = 'Dia Todo';
      if (turnoFormatado === 'manhã' || turnoFormatado === 'manha') turnoFormatado = 'Manhã';
      if (turnoFormatado === 'tarde') turnoFormatado = 'Tarde';

      const key = `${cargo} | Turno: ${turnoFormatado}`;

      if (!report[key]) {
        report[key] = { total: 0, ferias: 0, folgas: 0 };
      }

      report[key].total += 1;
      if (e.type === 'ferias') report[key].ferias += 1;
      if (e.type === 'folga') report[key].folgas += 1;
    });

    return report;
  };

  const impactReport = generateImpactReport();
  const impactKeys = Object.keys(impactReport);

  // === ATUALIZADO: Exportação para Excel agora tem Cargo e Turno ===
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
            <button 
              onClick={exportToCSV}
              style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', gap: '5px', alignItems: 'center' }}
            >
              ⬇️ Exportar CSV
            </button>
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

        {/* LISTA DE PROFISSIONAIS (AGORA COM CARGO E TURNO) */}
        <div className="absent-list">
          <h4 style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '10px' }}>Ausências da Equipe:</h4>
          {currentMonthEvents.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Nenhuma ausência neste mês.</p>
          ) : (
            <ul style={{ paddingLeft: '0', margin: 0, fontSize: '0.9rem', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '0.8rem', listStyle: 'none' }}>
              {currentMonthEvents.map(e => {
                const pro = professionals.find(p => p.id === e.professionalId);
                const cargo = professions.find(p => p.id === pro?.professionId)?.name || 'Sem cargo';
                
                let turnoBadge = pro?.shift || 'Dia Todo';
                if(turnoBadge === 'dia_todo') turnoBadge = 'Dia Todo';

                return (
                  <li key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: pro?.baseColor || '#ccc', flexShrink: 0, marginTop: '4px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>
                        <strong>{pro?.name || 'Desconhecido'}</strong> 
                        <span style={{ color: e.type === 'folga' ? '#ef4444' : '#3b82f6', fontSize: '0.8rem', marginLeft: '0.5rem', fontWeight: 'bold' }}>
                          ({e.type === 'folga' ? 'Folga' : 'Férias'})
                        </span>
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                        {cargo} • {turnoBadge}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* === A NOVA IDEIA: IMPACTO OPERACIONAL === */}
        {impactKeys.length > 0 && (
          <div style={{ backgroundColor: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '0.95rem' }}>📊 Impacto Operacional</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              
              {impactKeys.map(key => {
                const data = impactReport[key];
                // Se um setor tiver 2 ou mais ausências no mês, ganha um alerta!
                const isWarning = data.total >= 2; 

                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px', borderLeft: `4px solid ${isWarning ? '#f59e0b' : '#10b981'}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#4b5563' }}>
                        {isWarning && <span title="Atenção: Múltiplas ausências neste setor">⚠️ </span>}
                        {key.split('|')[0]} {/* Nome do Cargo */}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {key.split('|')[1]} {/* Turno */}
                      </span>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isWarning ? '#b45309' : '#047857' }}>
                        {data.total} ausência{data.total > 1 ? 's' : ''}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
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
  );
}