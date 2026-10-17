// Arquivo: src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PublicDashboard from './pages/PublicDashboard';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Portal do colaborador: cada um entra com matrícula e senha */}
        <Route path="/calendario" element={<PublicDashboard />} />

        {/* Quem decide se a sessão é de admin é o servidor: sem ela, o Dashboard manda para /login */}
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
