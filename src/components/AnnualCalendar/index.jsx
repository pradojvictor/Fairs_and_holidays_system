import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './index.css';

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Uma data digitada errada (ano 2099) não pode esticar a escala sem fim.
const ANOS_LIMITE = 5;

const anoDe = (data) => Number(String(data || '').slice(0, 4)) || null;

// Qual mês está no começo da faixa e quantos cabem na tela (dois; um no celular).
function medirVisivel(slider) {
  const filhos = slider?.children;
  if (!filhos?.length) return null;
  const passo = filhos.length > 1 ? filhos[1].offsetLeft - filhos[0].offsetLeft : filhos[0].offsetWidth;
  if (!(passo > 0)) return null;
  return {
    inicio: Math.min(filhos.length - 1, Math.max(0, Math.round(slider.scrollLeft / passo))),
    quantos: Math.max(1, Math.round(slider.clientWidth / filhos[0].offsetWidth)),
  };
}

export default function AnnualCalendar({ professionals = [], events = [], onEventClick }) {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();

  // A faixa de dois meses é contínua: de janeiro do ano passado (para, em janeiro, ainda ver
  // dezembro ao lado) até dezembro do ano que vem — ou do último ano com ausência lançada.
  // Férias de dezembro a janeiro aparecem inteiras, com os dois meses lado a lado.
  const anoInicio = anoAtual - 1;
  const anosEventos = events
    .flatMap((e) => [anoDe(e.startDate), anoDe(e.endDate)])
    .filter((a) => a && Math.abs(a - anoAtual) <= ANOS_LIMITE);
  const anoFim = Math.max(anoAtual + 1, ...anosEventos);
  // No "ano completo", as setas vão até o primeiro ano com ausência, para consultar o histórico.
  const anoPrimeiro = Math.min(anoInicio, ...anosEventos);
  const totalMeses = (anoFim - anoInicio + 1) * 12;
  const indiceHoje = (anoAtual - anoInicio) * 12 + hoje.getMonth();
  const anoDoIndice = (i) => anoInicio + Math.floor(i / 12);

  const [feriados, setFeriados] = useState({});
  const pedidosFeriados = useRef(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual);
  const [visivel, setVisivel] = useState({ inicio: indiceHoje, quantos: 2 });
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  const sliderRef = useRef(null);
  // Para onde a faixa rola quando aparece: o mês atual na abertura; ao recolher o ano
  // completo, o ponto onde estava (ou janeiro do ano escolhido nas setas).
  const destinoRef = useRef(indiceHoje);
  const anoAoExpandirRef = useRef(anoAtual);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const anosComFeriado = isExpanded
    ? [anoSelecionado]
    : Array.from({ length: anoFim - anoInicio + 1 }, (_, i) => anoInicio + i);
  const chaveFeriados = anosComFeriado.join(',');

  // Feriados de cada ano à mostra, buscados uma vez só por ano.
  useEffect(() => {
    for (const ano of chaveFeriados.split(',').map(Number)) {
      if (pedidosFeriados.current.has(ano)) continue;
      pedidosFeriados.current.add(ano);
      fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`)
        .then((response) => {
          if (!response.ok) throw new Error('Erro na API de Feriados');
          return response.json();
        })
        .then((data) => setFeriados((atual) => ({ ...atual, [ano]: data })))
        .catch((error) => {
          pedidosFeriados.current.delete(ano);
          console.error(`Não foi possível carregar os feriados de ${ano}:`, error);
        });
    }
  }, [chaveFeriados]);

  // Posiciona a faixa antes de pintar a tela. Salto direto e síncrono em vez de rolagem
  // animada: animação e requestAnimationFrame não rodam com a aba em segundo plano, e aí a
  // escala abria em janeiro.
  useLayoutEffect(() => {
    const slider = sliderRef.current;
    if (!slider || isExpanded) return;
    const alvo = slider.children[destinoRef.current];
    if (!alvo) return;
    slider.style.scrollBehavior = 'auto';
    slider.scrollLeft = alvo.offsetLeft - slider.children[0].offsetLeft;
    slider.style.scrollBehavior = '';
  }, [isExpanded]);

  // Mudou a largura da tela, muda quantos meses cabem (e o ano do título).
  useEffect(() => {
    if (isExpanded) return undefined;
    const medir = () => {
      const v = medirVisivel(sliderRef.current);
      if (v) setVisivel((atual) => (atual.inicio === v.inicio && atual.quantos === v.quantos ? atual : v));
    };
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [isExpanded]);

  const aoRolar = () => {
    if (isExpanded) return;
    const v = medirVisivel(sliderRef.current);
    if (v) setVisivel((atual) => (atual.inicio === v.inicio && atual.quantos === v.quantos ? atual : v));
  };

  // O título diz o ano dos meses na tela: "2026-2027" com dezembro e janeiro lado a lado.
  const inicioVisivel = Math.min(visivel.inicio, totalMeses - 1);
  const fimVisivel = Math.min(totalMeses - 1, inicioVisivel + visivel.quantos - 1);
  const anoA = anoDoIndice(inicioVisivel);
  const anoB = anoDoIndice(fimVisivel);
  const faixaAnos = anoA === anoB ? `${anoA}` : `${anoA}-${anoB}`;

  const alternarExpandido = () => {
    if (!isExpanded) {
      // O ano completo abre no ano do primeiro mês que estava na tela.
      const v = medirVisivel(sliderRef.current) || visivel;
      const ano = anoDoIndice(v.inicio);
      destinoRef.current = v.inicio;
      anoAoExpandirRef.current = ano;
      setAnoSelecionado(ano);
    } else {
      // Voltando para a faixa: onde estava, se o ano não mudou; senão, no ano escolhido.
      let destino = destinoRef.current;
      if (anoSelecionado !== anoAoExpandirRef.current) {
        destino = anoSelecionado === anoAtual
          ? indiceHoje
          : Math.min(totalMeses - 1, Math.max(0, (anoSelecionado - anoInicio) * 12));
      }
      destinoRef.current = destino;
      setVisivel((atual) => ({ ...atual, inicio: destino }));
    }
    setIsExpanded(!isExpanded);
  };

  const mudarAno = (e, passo) => {
    e.stopPropagation();
    setAnoSelecionado((ano) => Math.min(anoFim, Math.max(anoPrimeiro, ano + passo)));
  };

  const listaMeses = isExpanded
    ? meses.map((_, mes) => ({ ano: anoSelecionado, mes }))
    : Array.from({ length: totalMeses }, (_, i) => ({ ano: anoDoIndice(i), mes: i % 12 }));

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

  const getHolidayForDay = (year, monthIndex, day) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateString = `${year}-${m}-${d}`;
    return (feriados[year] || []).find(h => h.date === dateString);
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

      <div className="calendar-drawer-header" onClick={alternarExpandido}>
        <h3 className="calendar-drawer-title">
          Escala Anual{' '}
          {isExpanded ? (
            <span className="calendar-ano-nav">
              <button type="button" className="btn-ano" onClick={(e) => mudarAno(e, -1)}
                disabled={anoSelecionado <= anoPrimeiro} title="Ano anterior" aria-label="Ano anterior">‹</button>
              <strong>{anoSelecionado}</strong>
              <button type="button" className="btn-ano" onClick={(e) => mudarAno(e, 1)}
                disabled={anoSelecionado >= anoFim} title="Próximo ano" aria-label="Próximo ano">›</button>
            </span>
          ) : (
            <strong>{faixaAnos}</strong>
          )}
        </h3>
        <button type="button" className="btn-toggle-calendar">
          {isExpanded ? 'Ver Menos ▲' : 'Expandir Ano Completo ▼'}
        </button>
      </div>

      <div
        className={`months-wrapper ${isExpanded ? 'expanded' : 'slider'} ${isDragging ? 'dragging' : ''}`}
        ref={sliderRef}
        onScroll={aoRolar}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {listaMeses.map(({ ano, mes: indexMes }) => {
          const nomeMes = meses[indexMes];
          const daysCount = getDaysInMonth(indexMes, ano);
          const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1);
          return (
            <div key={`${ano}-${indexMes}`} className={`month-block ${indexMes === 0 ? 'inicio-ano' : ''}`}>
              <div className="month-header">
                <strong className="month-title">{nomeMes} <span className="month-ano">{ano}</span></strong>
                <div className="days-header-grid" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))` }}>
                  {daysArray.map(day => {
                    const holiday = getHolidayForDay(ano, indexMes, day);
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
              {/* --n e --linha deixam o CSS decidir a altura: no modo de dois meses as linhas
                  crescem até ocupar a tela; no "ano completo" ficam com 5px. */}
              <div
                className="month-body"
                style={{
                  '--n': Math.max(1, professionals.length),
                  gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${Math.max(1, professionals.length)}, var(--linha, 5px))`
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
                  const span = getEventSpan(event.startDate, event.endDate, indexMes, ano);
                  if (!span) return null;
                  const proIndex = professionals.findIndex(p => p.id === event.professionalId);
                  if (proIndex === -1) return null;
                  const pro = professionals[proIndex];
                  return (
                    <div
                      key={`${event.id}-${ano}-${indexMes}-${i}`}
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
