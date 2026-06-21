import './App.css'
import { OverviewPage } from './pages/Overview'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionsPage } from './pages/Sessions'
import { ErrorLog } from './pages/ErrorLog'
import { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { DomainProvider, useDomain } from './context/DomainContext'
import { SessionDetail } from './pages/SessionDetail'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Login } from './pages/Login'
import { useQueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient()

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { domain, setDomain, projects } = useDomain();
  const { user, logout } = useAuth();
  
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDomain, setNewProjectDomain] = useState('');
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const isActive = (path: string) => location.pathname === path;

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: newProjectName, domain: newProjectDomain })
        });
        if (!res.ok) throw new Error('Failed to create project');
        const newProject = await res.json();
        
        // Invalidate query to refresh the dropdown
        await queryClient.invalidateQueries({ queryKey: ['projects'] });
        
        // Auto select the new project
        setDomain(newProject.domain);
        setCreatedProjectId(newProject.id); // Show them their SDK snippet!
        
        setNewProjectName('');
        setNewProjectDomain('');
    } catch(err) {
        alert('Failed to create project');
    }
  };
  return (
    <div style={{
      width: '250px',
      borderRight: '1px solid var(--border-subtle)',
      background: 'var(--bg-card)',
      padding: '2rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
        <h2 style={{ color: 'var(--accent-primary)', margin: 0 }}>Browser SDK</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Dashboard</div>
      </div>

      {/** Domain Selector Dropdown */}
      <div style={{
        padding: '0 1rem',
        marginBottom: '2rem'
      }}>
        <label style={{
          fontSize: '0.875rem',
          color: 'var(--text-muted)',
          display: 'block',
          marginBottom: '0.5rem'
        }}>Active Domain</label>
        <select value={domain}
          onChange={(e) => setDomain(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            borderRadius: '4px',
            fontFamily: 'var(--font-mono)'
          }}>
          {/* Always show Demo Project */}
          <option value="localhost" style={{ color: '#000' }}>localhost (Demo)</option>
          
          {/* Map over user's custom projects */}
          {projects.map(p => (
            <option key={p.id} value={p.domain} style={{ color: '#000' }}>
              {p.domain}
            </option>
          ))}
        </select>

        {user && (
            <button 
                onClick={() => setIsAddingProject(true)}
                style={{
                    width: '100%',
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    background: 'transparent',
                    border: '1px dashed var(--accent-primary)',
                    color: 'var(--accent-primary)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                }}
            >
                + Add Project
            </button>
        )}
      </div>
      <button onClick={() => navigate('/')} style={navBtnStyle(isActive('/'))}>
        Overview
      </button>
      <button onClick={() => navigate('/sessions')} style={navBtnStyle(isActive('/sessions') || location.pathname.startsWith('/sessions/'))}>
        Sessions
      </button>
      <button onClick={() => navigate('/errors')} style={navBtnStyle(isActive('/errors'))}>
        Error Logs
      </button>

      {/* Auth Section at the bottom */}
      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
        {user ? (
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', wordBreak: 'break-all' }}>
              {user.email}
            </div>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                logout();
                navigate('/login');
              }}
              style={{ ...navBtnStyle(false), color: 'var(--status-critical)' }}
            >
              Log Out
            </button>
          </div>
        ) : (
          <button onClick={() => navigate('/login')} style={{ ...navBtnStyle(false), background: 'var(--accent-primary)', color: 'white', textAlign: 'center' }}>
            Log In / Sign Up
          </button>
        )}
      </div>

      {/* Add Project Modal */}
      {isAddingProject && (
          <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000
          }}>
              <div className='glass-card' style={{ padding: '2rem', width: '400px' }}>
                  {!createdProjectId ? (
                      <form onSubmit={handleCreateProject}>
                          <h2 style={{marginTop: 0}}>Add New Project</h2>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                              <input 
                                  placeholder="Project Name (e.g. My Startup)" 
                                  required 
                                  value={newProjectName} 
                                  onChange={e => setNewProjectName(e.target.value)}
                                  style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', color: 'white' }}
                              />
                              <input 
                                  placeholder="Domain (e.g. example.com)" 
                                  required 
                                  value={newProjectDomain} 
                                  onChange={e => setNewProjectDomain(e.target.value)}
                                  style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', color: 'white' }}
                              />
                          </div>
                          <div style={{ display: 'flex', gap: '1rem' }}>
                              <button type="submit" style={{ flex: 1, padding: '0.5rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Create</button>
                              <button type="button" onClick={() => setIsAddingProject(false)} style={{ flex: 1, padding: '0.5rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                          </div>
                      </form>
                  ) : (
                      <div>
                          <h2 style={{marginTop: 0, color: 'var(--status-good)'}}>Success!</h2>
                          <p style={{ color: 'var(--text-secondary)'}}>Your project is registered. Copy this snippet into your HTML <code>&lt;head&gt;</code> tag:</p>
                          <pre style={{
                              background: 'rgba(0,0,0,0.3)',
                              padding: '1rem',
                              borderRadius: '4px',
                              overflowX: 'auto',
                              fontSize: '0.8rem',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--accent-primary)'
                          }}>
{`<script src="https://your-cdn.com/sdk.js" 
  data-project-id="${createdProjectId}"
  data-ingest-url="http://localhost:3000/api/ingest">
</script>`}
                          </pre>
                          <button onClick={() => {
                              setIsAddingProject(false);
                              setCreatedProjectId(null);
                          }} style={{ width: '100%', marginTop: '1.5rem', padding: '0.5rem', background: 'var(--bg-card)', color: 'white', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  )
}

function App() {

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DomainProvider>
          <BrowserRouter>
            <div style={{
              display: 'flex',
              minHeight: '100vh',
              width: '100vw'
            }}>
              {/* Sidebar */}
              <Sidebar />
              <div style={{
                flex: 1,
                overflowY: 'auto'
              }}>
                <Routes>
                  <Route path='/login' element={<Login />} />
                  <Route path='/' element={<OverviewPage />} />
                  <Route path="/sessions" element={<SessionsPage />} />
                  <Route path='/sessions/:id' element={<SessionDetail />} />
                  <Route path="/errors" element={<ErrorLog />} />
                </Routes>
              </div>
            </div>
          </BrowserRouter>
        </DomainProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

const navBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
  border: 'none',
  padding: '1rem',
  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
  textAlign: 'left',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: active ? 'bold' : 'normal',
  transition: 'background 0.2s',
  display: 'block',
  width: '100%',
  fontFamily: 'var(--font-sans)',
  fontSize: '1rem'
});

export default App
