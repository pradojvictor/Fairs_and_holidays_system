// Arquivo: src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import { useState } from 'react';
import Sidebar from './components/Sidebar';


// Componente que protege a rota: só deixa passar se tiver logado
const PrivateRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  return isAuthenticated === 'true' ? children : <Navigate to="/login" />;
};

// Um componente temporário para o nosso painel principal
const Dashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'sans-serif' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header style={{ padding: '1rem 2rem', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          ☰ Menu
        </button>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Controle de Férias e Folgas</h2>
        <div style={{ width: '80px' }}></div> {/* Spacer para centralizar o título */}
      </header>

      <main style={{ padding: '2rem' }}>
        {/* Aqui entrarão os dois calendários futuramente */}
        <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <p>Selecione uma opção no menu lateral para começar.</p>
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* A rota principal (/) é protegida */}
        <Route 
          path="/" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;