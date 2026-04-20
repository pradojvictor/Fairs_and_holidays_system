// Arquivo: src/pages/PublicDashboard.jsx
import { useState, useEffect } from 'react';
import AnnualCalendar from '../../components/AnnualCalendar';
import MonthlySummary from '../../components/MonthlySummary';
import ProfessionalList from '../../components/ProfessionalList';
import { fetchGistData } from '../../services/githubApi';

export default function PublicDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [dbData, setDbData] = useState({ professionals: [], events: [] });

  const [filterProf, setFilterProf] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchGistData();
        setDbData({ professionals: data.professionals || [], events: data.events || [] });
      } catch (err) {
        setError('Erro ao carregar o calendário.');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredEvents = dbData.events.filter(event => {
    const matchProf = filterProf ? event.professionalId === filterProf : true;
    const matchType = filterType ? event.type === filterType : true;
    return matchProf && matchType;
  });

  const filteredProfessionals = dbData.professionals.filter(pro => {
    return filterProf ? pro.id === filterProf : true;
  });

  return (
    <div className="dashboard-layout" style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', paddingBottom: '80px' }}>
      
      {/* HEADER SIMPLIFICADO SEM BOTÕES */}
      <header className="dashboard-header" style={{ justifyContent: 'center' }}>
        <h2 className="dashboard-title">Calendário da Equipe</h2>
      </header>

      <main className="dashboard-main" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        
        {isLoading ? <div className="status-container"><h2>Carregando Calendário...</h2></div> : null}
        {error ? <div className="status-container"><h2 style={{color: '#ef4444'}}>{error}</h2></div> : null}

        {!isLoading && !error && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* BARRA DE FILTROS */}
              <div style={{ display: 'flex', gap: '1rem', backgroundColor: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#374151' }}>Buscar Funcionário:</label>
                  <select value={filterProf} onChange={(e) => setFilterProf(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                    <option value="">Todos da Equipe</option>
                    {dbData.professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#374151' }}>Filtrar Tipo:</label>
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                    <option value="">Todos</option>
                    <option value="ferias">Apenas Férias</option>
                    <option value="folga">Apenas Folgas</option>
                  </select>
                </div>
              </div>

              {/* CALENDÁRIO ANUAL (Sem o onClick de editar) */}
              <div className="calendar-wrapper">
                <AnnualCalendar professionals={dbData.professionals} events={filteredEvents} />
              </div>
            </div>

            {/* RESUMO MENSAL */}
            <MonthlySummary professionals={dbData.professionals} events={dbData.events} />
          </>
        )}
      </main>

      {/* A GAVETA DE DETALHES QUE SOBE DA BASE */}
      {!isLoading && !error && (
        <ProfessionalList professionals={filteredProfessionals} events={filteredEvents} />
      )}
      
    </div>
  );
}


//quero mudar para ser naturalmente responsivo em mobile!