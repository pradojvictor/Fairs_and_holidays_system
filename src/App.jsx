// Arquivo: src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';


// Componente que protege a rota: só deixa passar se tiver logado
const PrivateRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  return isAuthenticated === 'true' ? children : <Navigate to="/login" />;
};

// Um componente temporário para o nosso painel principal
const Dashboard = () => {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Painel de Férias e Folgas</h1>
      <p>Bem-vindo! Em breve os calendários estarão aqui.</p>
      <button 
        onClick={() => {
          localStorage.removeItem('isAuthenticated');
          window.location.reload();
        }}
      >
        Sair
      </button>
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