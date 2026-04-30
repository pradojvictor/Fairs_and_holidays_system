// Arquivo: src/components/ProfessionalList.jsx
import React, { useState } from 'react';
import './index.css';

export default function ProfessionalList({ professionals = [], events = [] }) {
  const [expandedId, setExpandedId] = useState(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <>
      {isDrawerOpen && (
        <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)} />
      )}
      <div className={`prof-list-wrapper ${isDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header" onClick={() => setIsDrawerOpen(!isDrawerOpen)}>
          <div className="drawer-handle-pill"></div>
          <div className="drawer-title-row">
            <span>Controle Detalhado da Equipe</span>
            <span>{isDrawerOpen ? '▼' : '▲'}</span>
          </div>
        </div>
        <div className="prof-list-content">
          <div className="prof-cards-grid">
            {professionals.map(pro => {
              const proEvents = events
                .filter(e => String(e.professionalId) === String(pro.id))
                .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
              const isExpanded = expandedId === pro.id;

              return (
                <div key={pro.id} className="prof-card">
                  <div className="prof-card-summary" onClick={() => toggleExpand(pro.id)}>
                    <div className="prof-info-main">
                      <span
                        style={{ backgroundColor: pro.baseColor, width: '16px', height: '16px', borderRadius: '50%' }}
                      />
                      <span className="prof-name">{pro.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span className="event-count-badge">
                        {proEvents.length} {proEvents.length === 1 ? 'registro' : 'registros'}
                      </span>
                      <span>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="prof-card-details">
                      {proEvents.length === 0 ? (
                        <p className="empty-state">Este profissional não possui férias ou folgas programadas.</p>
                      ) : (
                        <ul className="details-list">
                          {proEvents.map(event => {
                            const endDate = new Date(`${event.endDate}T12:00:00`);
                            const isPast = endDate < today;

                            return (
                              <li key={event.id} className="detail-item">
                                <span className={`status-dot ${isPast ? 'past' : 'future'}`} title={isPast ? "Já ocorreu" : "Programado"} />
                                <div className="detail-text">
                                  <span className="detail-title">
                                    {event.type === 'ferias' ? 'Férias' : event.type === 'folga' ? 'Folga' : 'Atestado'}
                                  </span>
                                  <span className="detail-dates">
                                    De {formatDate(event.startDate)} até {formatDate(event.endDate)}
                                  </span>
                                  {event.reason && (
                                    <span className="detail-reason">Motivo: {event.reason}</span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}