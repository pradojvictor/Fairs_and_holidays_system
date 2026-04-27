import './index.css';

export default function EventDetailModal({ isOpen, event, professional, onClose, onDelete, onEdit }) {
  if (!isOpen || !event || !professional) return null;

  const formatDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="detail-modal-overlay">
      <div className="detail-modal-container">
        <div className="detail-modal-header" style={{ backgroundColor: professional.baseColor }}>
          <h3 style={{ margin: 0 }}>Detalhes da Ausência</h3>
          <button onClick={onClose} className="btn-close-detail-top">&times;</button>
        </div>

        <div className="detail-modal-content">
          <div className="detail-info-group">
            <span className="detail-label">Profissional</span>
            <span className="detail-value">{professional.name}</span>
          </div>

          <div className="detail-info-group">
            <span className="detail-label">Tipo</span>
            <span className="detail-value" style={{ color: event.type === 'folga' ? '#ef4444' : professional.baseColor }}>
              {event.type === 'folga' ? 'Folga' : 'Férias'}
            </span>
          </div>

          <div className="detail-info-group">
            <span className="detail-label">Período</span>
            <span className="detail-value">
              {formatDate(event.startDate)} até {formatDate(event.endDate)}
            </span>
          </div>

          {event.reason && (
            <div className="detail-info-group">
              <span className="detail-label">Motivo</span>
              <div className="detail-reason-box">{event.reason}</div>
            </div>
          )}
        </div>

        <div className="detail-modal-footer">
          <button className="btn-close-detail" onClick={onClose}>Fechar</button>
          <button className="btn-edit-event" onClick={() => onEdit(event)}>Editar</button>
          <button className="btn-delete-event" onClick={() => onDelete(event.id)}>
            Excluir Agendamento
          </button>
        </div>
      </div>
    </div>
  );
}