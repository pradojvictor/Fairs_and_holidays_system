// src/components/Sidebar.jsx
import { useNavigate } from 'react-router-dom';

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  // Estilos básicos para a Sidebar
  const sidebarStyle = {
    position: 'fixed',
    top: 0,
    left: isOpen ? 0 : '-300px', // Esconde/mostra a aba
    width: '280px',
    height: '100%',
    backgroundColor: '#1f2937', // Tom escuro profissional
    color: 'white',
    transition: 'left 0.3s ease',
    zIndex: 1000,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '4px 0 10px rgba(0,0,0,0.2)'
  };

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: isOpen ? 'block' : 'none',
    zIndex: 999
  };

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div style={sidebarStyle}>
        <div style={{ marginBottom: '2rem', borderBottom: '1px solid #374151', paddingBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Menu Administrativo</h3>
          <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Logado como: <strong>admin</strong></p>
        </div>

        <nav style={{ flexGrow: 1 }}>
          <h4 style={{ color: '#6366f1', marginBottom: '1rem' }}>Configurações</h4>
          {/* Espaço futuro para a lista de profissionais */}
          <p style={{ fontSize: '0.9rem' }}>Gerenciar Profissionais (Em breve)</p>
        </nav>

        <button 
          onClick={handleLogout}
          style={{
            padding: '0.75rem',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginTop: 'auto'
          }}
        >
          Sair do Sistema
        </button>
      </div>
    </>
  );
}