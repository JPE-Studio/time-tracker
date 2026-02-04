import { useState, useEffect } from 'react';
import type { Client, Project, TimeEntry } from './types';
import {
  loadData,
  addClient,
  updateClient,
  deleteClient,
  addProject,
  updateProject,
  deleteProject,
  addTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  startTimer,
  stopTimer,
  getRunningTimer,
  downloadCSV,
} from './storage';
import './App.css';

type View = 'dashboard' | 'clients' | 'projects' | 'time-entries';

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [data, setData] = useState(loadData());
  const [runningTimer, setRunningTimer] = useState<TimeEntry | null>(getRunningTimer());
  const [elapsedTime, setElapsedTime] = useState(0);

  // Refresh data when view changes
  useEffect(() => {
    setData(loadData());
  }, [view]);

  // Timer interval
  useEffect(() => {
    if (!runningTimer) return;

    const interval = setInterval(() => {
      const start = new Date(runningTimer.startTime).getTime();
      const now = Date.now();
      setElapsedTime(Math.floor((now - start) / 1000) + runningTimer.duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [runningTimer]);

  const refreshData = () => setData(loadData());

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDurationShort = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const handleStartTimer = (projectId: string, clientId: string, description: string) => {
    const timer = startTimer(projectId, clientId, description);
    setRunningTimer(timer);
    setElapsedTime(0);
    refreshData();
  };

  const handleStopTimer = () => {
    if (runningTimer) {
      stopTimer(runningTimer.id);
      setRunningTimer(null);
      setElapsedTime(0);
      refreshData();
    }
  };

  // Dashboard View
  const Dashboard = () => {
    const totalHours = data.timeEntries.reduce((sum, e) => sum + e.duration, 0) / 3600;
    const today = new Date().toDateString();
    const todayHours = data.timeEntries
      .filter(e => new Date(e.startTime).toDateString() === today)
      .reduce((sum, e) => sum + e.duration, 0) / 3600;

    return (
      <div className="dashboard">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{data.clients.length}</div>
            <div className="stat-label">Kunden</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.projects.length}</div>
            <div className="stat-label">Projekte</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalHours.toFixed(1)}h</div>
            <div className="stat-label">Gesamtstunden</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{todayHours.toFixed(1)}h</div>
            <div className="stat-label">Heute</div>
          </div>
        </div>

        {runningTimer && (
          <div className="active-timer">
            <div className="timer-display">{formatDuration(elapsedTime)}</div>
            <div className="timer-info">
              {data.projects.find(p => p.id === runningTimer.projectId)?.name}
            </div>
            <button className="btn btn-danger btn-large" onClick={handleStopTimer}>
              ■ Stoppen
            </button>
          </div>
        )}

        <QuickTimer onStart={handleStartTimer} clients={data.clients} projects={data.projects} />
      </div>
    );
  };

  // Quick Timer Component
  const QuickTimer = ({ 
    onStart, 
    clients, 
    projects 
  }: { 
    onStart: (projectId: string, clientId: string, description: string) => void;
    clients: Client[];
    projects: Project[];
  }) => {
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [description, setDescription] = useState('');

    const filteredProjects = projects.filter(p => p.clientId === selectedClient);

    const handleStart = () => {
      if (selectedProject && description) {
        const project = projects.find(p => p.id === selectedProject);
        if (project) {
          onStart(selectedProject, project.clientId, description);
          setDescription('');
        }
      }
    };

    return (
      <div className="quick-timer card">
        <h3>Schnell-Timer</h3>
        <div className="form-group">
          <label>Kunde</label>
          <select 
            value={selectedClient} 
            onChange={(e) => {
              setSelectedClient(e.target.value);
              setSelectedProject('');
            }}
          >
            <option value="">Kunde wählen...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Projekt</label>
          <select 
            value={selectedProject} 
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={!selectedClient}
          >
            <option value="">Projekt wählen...</option>
            {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Beschreibung</label>
          <input 
            type="text" 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Was machst du gerade?"
          />
        </div>
        <button 
          className="btn btn-primary btn-large" 
          onClick={handleStart}
          disabled={!selectedProject || !description}
        >
          ▶ Timer starten
        </button>
      </div>
    );
  };

  // Clients View
  const ClientsView = () => {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Client | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', notes: '' });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (editing) {
        updateClient(editing.id, formData);
      } else {
        addClient(formData);
      }
      setShowForm(false);
      setEditing(null);
      setFormData({ name: '', email: '', phone: '', address: '', notes: '' });
      refreshData();
    };

    const handleEdit = (client: Client) => {
      setEditing(client);
      setFormData({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        notes: client.notes || '',
      });
      setShowForm(true);
    };

    const handleDelete = (id: string) => {
      if (confirm('Kunde wirklich löschen? Alle Projekte und Zeiteinträge werden auch gelöscht.')) {
        deleteClient(id);
        refreshData();
      }
    };

    return (
      <div className="clients-view">
        <div className="view-header">
          <h2>Kunden</h2>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Neuer Kunde</button>
        </div>

        {showForm && (
          <form className="card form-card" onSubmit={handleSubmit}>
            <h3>{editing ? 'Kunde bearbeiten' : 'Neuer Kunde'}</h3>
            <div className="form-group">
              <label>Name *</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Telefon</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Adresse</label>
              <textarea 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Notizen</label>
              <textarea 
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}>Abbrechen</button>
              <button type="submit" className="btn btn-primary">Speichern</button>
            </div>
          </form>
        )}

        <div className="list">
          {data.clients.map(client => (
            <div key={client.id} className="list-item">
              <div className="list-item-content">
                <div className="list-item-title">{client.name}</div>
                {client.email && <div className="list-item-subtitle">✉ {client.email}</div>}
                {client.phone && <div className="list-item-subtitle">☎ {client.phone}</div>}
              </div>
              <div className="list-item-actions">
                <button className="btn btn-icon" onClick={() => handleEdit(client)}>✏️</button>
                <button className="btn btn-icon btn-danger" onClick={() => handleDelete(client.id)}>🗑️</button>
              </div>
            </div>
          ))}
          {data.clients.length === 0 && <div className="empty">Noch keine Kunden vorhanden</div>}
        </div>
      </div>
    );
  };

  // Projects View
  const ProjectsView = () => {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Project | null>(null);
    const [formData, setFormData] = useState({ clientId: '', name: '', description: '', hourlyRate: '' });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const projectData = {
        ...formData,
        hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : undefined,
      };
      if (editing) {
        updateProject(editing.id, projectData);
      } else {
        addProject(projectData as Omit<Project, 'id' | 'createdAt'>);
      }
      setShowForm(false);
      setEditing(null);
      setFormData({ clientId: '', name: '', description: '', hourlyRate: '' });
      refreshData();
    };

    const handleEdit = (project: Project) => {
      setEditing(project);
      setFormData({
        clientId: project.clientId,
        name: project.name,
        description: project.description || '',
        hourlyRate: project.hourlyRate?.toString() || '',
      });
      setShowForm(true);
    };

    const handleDelete = (id: string) => {
      if (confirm('Projekt wirklich löschen? Alle Zeiteinträge werden auch gelöscht.')) {
        deleteProject(id);
        refreshData();
      }
    };

    return (
      <div className="projects-view">
        <div className="view-header">
          <h2>Projekte</h2>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Neues Projekt</button>
        </div>

        {showForm && (
          <form className="card form-card" onSubmit={handleSubmit}>
            <h3>{editing ? 'Projekt bearbeiten' : 'Neues Projekt'}</h3>
            <div className="form-group">
              <label>Kunde *</label>
              <select 
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                required
              >
                <option value="">Kunde wählen...</option>
                {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Projektname *</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Beschreibung</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Stundensatz (€)</label>
              <input 
                type="number" 
                step="0.01"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}>Abbrechen</button>
              <button type="submit" className="btn btn-primary">Speichern</button>
            </div>
          </form>
        )}

        <div className="list">
          {data.projects.map(project => {
            const client = data.clients.find(c => c.id === project.clientId);
            const timeEntries = data.timeEntries.filter(e => e.projectId === project.id);
            const totalSeconds = timeEntries.reduce((sum, e) => sum + e.duration, 0);
            
            return (
              <div key={project.id} className="list-item">
                <div className="list-item-content">
                  <div className="list-item-title">{project.name}</div>
                  <div className="list-item-subtitle">👤 {client?.name || 'Unbekannt'}</div>
                  <div className="list-item-meta">⏱️ {formatDurationShort(totalSeconds)}</div>
                </div>
                <div className="list-item-actions">
                  <button className="btn btn-icon" onClick={() => handleEdit(project)}>✏️</button>
                  <button className="btn btn-icon btn-danger" onClick={() => handleDelete(project.id)}>🗑️</button>
                </div>
              </div>
            );
          })}
          {data.projects.length === 0 && <div className="empty">Noch keine Projekte vorhanden</div>}
        </div>
      </div>
    );
  };

  // Time Entries View
  const TimeEntriesView = () => {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<TimeEntry | null>(null);
    const [formData, setFormData] = useState({
      clientId: '',
      projectId: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '17:00',
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.date}T${formData.endTime}`);
      const duration = Math.floor((endDateTime.getTime() - startDateTime.getTime()) / 1000);

      const entryData = {
        clientId: formData.clientId,
        projectId: formData.projectId,
        description: formData.description,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        duration: Math.max(0, duration),
        isRunning: false,
      };

      if (editing) {
        updateTimeEntry(editing.id, entryData);
      } else {
        addTimeEntry(entryData);
      }
      
      setShowForm(false);
      setEditing(null);
      setFormData({
        clientId: '',
        projectId: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00',
      });
      refreshData();
    };

    const handleEdit = (entry: TimeEntry) => {
      setEditing(entry);
      const start = new Date(entry.startTime);
      const end = entry.endTime ? new Date(entry.endTime) : start;
      
      setFormData({
        clientId: entry.clientId,
        projectId: entry.projectId,
        description: entry.description,
        date: start.toISOString().split('T')[0],
        startTime: start.toTimeString().slice(0, 5),
        endTime: end.toTimeString().slice(0, 5),
      });
      setShowForm(true);
    };

    const handleDelete = (id: string) => {
      if (confirm('Zeiteintrag wirklich löschen?')) {
        deleteTimeEntry(id);
        refreshData();
      }
    };

    const filteredProjects = data.projects.filter(p => p.clientId === formData.clientId);

    const sortedEntries = [...data.timeEntries].sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    return (
      <div className="time-entries-view">
        <div className="view-header">
          <h2>Zeiterfassung</h2>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={downloadCSV}>📥 CSV Export</button>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Manueller Eintrag</button>
          </div>
        </div>

        {showForm && (
          <form className="card form-card" onSubmit={handleSubmit}>
            <h3>{editing ? 'Eintrag bearbeiten' : 'Manueller Zeiteintrag'}</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Kunde *</label>
                <select 
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value, projectId: '' })}
                  required
                >
                  <option value="">Kunde wählen...</option>
                  {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Projekt *</label>
                <select 
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  required
                  disabled={!formData.clientId}
                >
                  <option value="">Projekt wählen...</option>
                  {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Beschreibung *</label>
              <input 
                type="text" 
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Datum</label>
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Start</label>
                <input 
                  type="time" 
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Ende</label>
                <input 
                  type="time" 
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}>Abbrechen</button>
              <button type="submit" className="btn btn-primary">Speichern</button>
            </div>
          </form>
        )}

        <div className="list">
          {sortedEntries.map(entry => {
            const client = data.clients.find(c => c.id === entry.clientId);
            const project = data.projects.find(p => p.id === entry.projectId);
            
            return (
              <div key={entry.id} className={`list-item ${entry.isRunning ? 'running' : ''}`}>
                <div className="list-item-content">
                  <div className="list-item-title">{entry.description}</div>
                  <div className="list-item-subtitle">
                    👤 {client?.name || 'Unbekannt'} • 📁 {project?.name || 'Unbekannt'}
                  </div>
                  <div className="list-item-meta">
                    📅 {new Date(entry.startTime).toLocaleDateString('de-DE')} • 
                    🕐 {new Date(entry.startTime).toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'})}
                    {entry.endTime && ` - ${new Date(entry.endTime).toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'})}`}
                    {' • '}
                    ⏱️ {formatDurationShort(entry.duration)}
                    {entry.isRunning && <span className="badge">LÄUFT</span>}
                  </div>
                </div>
                <div className="list-item-actions">
                  <button className="btn btn-icon" onClick={() => handleEdit(entry)}>✏️</button>
                  <button className="btn btn-icon btn-danger" onClick={() => handleDelete(entry.id)}>🗑️</button>
                </div>
              </div>
            );
          })}
          {data.timeEntries.length === 0 && <div className="empty">Noch keine Zeiteinträge vorhanden</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>⏱️ TimeTracker</h1>
      </header>

      <nav className="nav">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
          📊 Dashboard
        </button>
        <button className={view === 'clients' ? 'active' : ''} onClick={() => setView('clients')}>
          👥 Kunden
        </button>
        <button className={view === 'projects' ? 'active' : ''} onClick={() => setView('projects')}>
          📁 Projekte
        </button>
        <button className={view === 'time-entries' ? 'active' : ''} onClick={() => setView('time-entries')}>
          ⏱️ Zeiten
        </button>
      </nav>

      <main className="main">
        {view === 'dashboard' && <Dashboard />}
        {view === 'clients' && <ClientsView />}
        {view === 'projects' && <ProjectsView />}
        {view === 'time-entries' && <TimeEntriesView />}
      </main>
    </div>
  );
}

export default App;
