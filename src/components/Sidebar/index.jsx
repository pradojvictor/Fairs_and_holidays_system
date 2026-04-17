// Arquivo: src/components/Sidebar.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGistData, updateGistData } from '../../services/githubApi';


export default function Sidebar({ isOpen, onClose, onDataUpdated }) {
  const navigate = useNavigate();
  
  // Estados para o formulário
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6'); // Azul como cor padrão
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  const handleAddProfessional = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      // 1. Busca os dados mais recentes do Gist
      const currentData = await fetchGistData();
      
      // 2. Cria o novo objeto do profissional (gerando uma ID única baseada no tempo)
      const newProfessional = {
        id: `p_${Date.now()}`,
        name: name.trim(),
        baseColor: color
      };

      // 3. Adiciona ao array existente
      currentData.professionals = [...(currentData.professionals || []), newProfessional];

      // 4. Salva tudo de volta no Gist
      await updateGistData(currentData);

      // Limpa o formulário e mostra sucesso
      setName('');
      setColor('#3b82f6');
      setFeedback({ type: 'success', message: 'Profissional adicionado!' });
      
      // Se houver uma função para atualizar a tela principal, nós a chamamos
      if (onDataUpdated) onDataUpdated();

      // Limpa a mensagem de sucesso após 3 segundos
      setTimeout(() => setFeedback({ type: '', message: '' }), 3000);

    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: 'Erro ao salvar. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  // === Estilos ===
  const sidebarStyle = {
    position: 'fixed',
    top: 0,
    left: isOpen ? 0 : '-320px',
    width: '320px',
    height: '100%',
    backgroundColor: '#1f2937', // Fundo escuro
    color: '#f9fafb',
    transition: 'left 0.3s ease',
    zIndex: 1000,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '4px 0 10px rgba(0,0,0,0.3)',
    overflowY: 'auto'
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

  const inputStyle = {
    width: '100%',
    padding: '0.5rem',
    borderRadius: '4px',
    border: '1px solid #4b5563',
    backgroundColor: '#374151',
    color: 'white',
    marginBottom: '1rem',
    boxSizing: 'border-box'
  };

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div style={sidebarStyle}>
        
        {/* Cabeçalho da Sidebar */}
        <div style={{ marginBottom: '2rem', borderBottom: '1px solid #374151', paddingBottom: '1rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Painel Administrativo</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#9ca3af' }}>Logado como: <strong style={{ color: 'white' }}>admin</strong></p>
        </div>

        {/* Corpo da Sidebar - Formulário de Cadastro */}
        <div style={{ flexGrow: 1 }}>
          <h3 style={{ color: '#60a5fa', marginBottom: '1rem', fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Novo Profissional</span>
          </h3>

          <form onSubmit={handleAddProfessional} style={{ backgroundColor: '#111827', padding: '1rem', borderRadius: '8px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#d1d5db' }}>Nome do Funcionário</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              required
              style={inputStyle}
            />

            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#d1d5db' }}>Cor de Identificação no Calendário</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: '50px', height: '35px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
              />
              <span style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{color}</span>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              {loading ? 'Salvando...' : 'Salvar Profissional'}
            </button>

            {/* Mensagens de Feedback */}
            {feedback.message && (
              <p style={{ marginTop: '1rem', fontSize: '0.85rem', textAlign: 'center', color: feedback.type === 'error' ? '#ef4444' : '#10b981' }}>
                {feedback.message}
              </p>
            )}
          </form>
        </div>

        {/* Rodapé - Botão de Sair */}
        <button 
          onClick={handleLogout}
          style={{ padding: '0.75rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '2rem' }}
        >
          Sair do Sistema
        </button>
      </div>
    </>
  );
}