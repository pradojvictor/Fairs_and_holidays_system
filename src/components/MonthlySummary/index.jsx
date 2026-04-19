// Arquivo: src/components/MonthlySummary.jsx
import React, { useState } from 'react';
import './index.css';

export default function MonthlySummary({ professionals = [], events = [] }) {
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

  const realToday = new Date();
  const isRealCurrentMonth = realToday.getFullYear() === currentYear && realToday.getMonth() === currentMonth;

  // === NOVA FUNÇÃO DE EXPORTAÇÃO PARA CSV/EXCEL ===
  const exportToCSV = () => {
    if (currentMonthEvents.length === 0) {
      alert("Não há ausências para exportar neste mês.");
      return;
    }

    // Cabeçalho das colunas no Excel
    let csvContent = "Profissional;Tipo;Data Inicio;Data Fim;Motivo\n";

    currentMonthEvents.forEach(e => {
      const pro = professionals.find(p => p.id === e.professionalId);
      // Pega o nome (remove ponto e vírgula se houver para não quebrar a planilha)
      const name = pro ? pro.name.replace(/;/g, ",") : 'Desconhecido';
      const type = e.type === 'folga' ? 'Folga' : 'Férias';
      
      const start = new Date(`${e.startDate}T12:00:00`).toLocaleDateString('pt-BR');
      const end = new Date(`${e.endDate}T12:00:00`).toLocaleDateString('pt-BR');
      const reason = e.reason ? e.reason.replace(/;/g, ",") : '-';

      csvContent += `${name};${type};${start};${end};${reason}\n`;
    });

    // \uFEFF força o Excel a reconhecer acentos (UTF-8)
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

      {/* LADO DIREITO: Indicadores do Mês */}
      <div className="indicators-card">
        
        {/* NOVO: Cabeçalho com o botão de exportar alinhado à direita */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#111827', fontSize: '1.2rem', textTransform: 'capitalize' }}>
            Resumo de {monthName}
          </h3>
          <button 
            onClick={exportToCSV}
            style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', gap: '5px', alignItems: 'center' }}
            title="Baixar planilha do mês"
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

        <div className="absent-list">
          <h4>Profissionais Ausentes neste mês:</h4>
          {currentMonthEvents.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Nenhuma ausência registrada para {monthName}.</p>
          ) : (
            <ul style={{ paddingLeft: '0', margin: 0, fontSize: '0.9rem', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '0.6rem', listStyle: 'none' }}>
              {currentMonthEvents.map(e => {
                const pro = professionals.find(p => p.id === e.professionalId);
                return (
                  <li key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span 
                      style={{ 
                        width: '12px', height: '12px', borderRadius: '50%', 
                        backgroundColor: pro?.baseColor || '#ccc', flexShrink: 0,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }} 
                    />
                    <span>
                      <strong>{pro?.name || 'Desconhecido'}</strong> 
                      <span style={{ color: '#9ca3af', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                        ({e.type === 'folga' ? 'Folga' : 'Férias'})
                      </span>
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