import { useState, useEffect, useMemo, useRef } from 'react';
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
  pauseTimer,
  resumeTimer,
  getRunningTimer,
  downloadCSV,
  exportToHTML,
  exportCustomerToHTML,
  getWeeklyGoal,
  setWeeklyGoal,
} from './storage';
import './App.css';

type View = 'dashboard' | 'clients' | 'time-entries' | 'reports';
type TimerState = 'idle' | 'running' | 'paused';

const QUICK_TASKS = ['Meeting', 'Development', 'Email', 'Research', 'Planning', 'Review'];

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [data, setData] = useState(loadData());
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('timetracker_darkmode');
    return saved ? JSON.parse(saved) : false;
  });
  
  // Timer state
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Timer form state (filled while timer runs)
  const [selectedClient, setSelectedClient] = useState<string | undefined>('');
  const [selectedProject, setSelectedProject] = useState<string | undefined>('');
  const [description, setDescription] = useState('');

  // Auto-save description timeout ref
  const descriptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh data when view changes
  useEffect(() => {
    setData(loadData());
  }, [view]);

  // Check for existing running timer on mount
  useEffect(() => {
    const running = getRunningTimer();
    if (running) {
      setCurrentEntry(running);
      setTimerState('running');
      setSelectedClient(running.clientId);
      setSelectedProject(running.projectId);
      setDescription(running.description);
    }
  }, []);

  // Timer interval
  useEffect(() => {
    if (timerState !== 'running' || !currentEntry) return;

    const interval = setInterval(() => {
      const start = new Date(currentEntry.startTime).getTime();
      const now = Date.now();
      setElapsedTime(Math.floor((now - start) / 1000) + currentEntry.duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [timerState, currentEntry]);

  // Dark mode effect
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('timetracker_darkmode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
    };
  }, []);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // Auto-save description
  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }
    
    if (currentEntry) {
      descriptionTimeoutRef.current = setTimeout(() => {
        updateTimeEntry(currentEntry.id, { description: value });
        setCurrentEntry({ ...currentEntry, description: value });
      }, 500);
    }
  };

  // Timer controls
  const handleStartTimer = () => {
    const timer = startTimer('', '', '');
    setCurrentEntry(timer);
    setTimerState('running');
    setElapsedTime(0);
    setSelectedClient('');
    setSelectedProject('');
    setDescription('');
    refreshData();
  };

  const handleStartTimerWithTask = (taskName: string) => {
    const timer = startTimer('', '', taskName);
    setCurrentEntry(timer);
    setTimerState('running');
    setElapsedTime(0);
    setSelectedClient('');
    setSelectedProject('');
    setDescription(taskName);
    refreshData();
  };

  const handlePauseTimer = () => {
    if (currentEntry) {
      pauseTimer(currentEntry.id);
      const updated = { ...currentEntry, isRunning: false };
      setCurrentEntry(updated);
      setTimerState('paused');
      refreshData();
    }
  };

  const handleResumeTimer = () => {
    if (currentEntry) {
      const resumed = resumeTimer(currentEntry.id);
      if (resumed) {
        setCurrentEntry(resumed);
        setTimerState('running');
      }
      refreshData();
    }
  };

  const handleStopTimer = () => {
    if (currentEntry) {
      // Clear any pending auto-save
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
      
      // Update entry with selected details before stopping
      updateTimeEntry(currentEntry.id, {
        clientId: selectedClient || undefined,
        projectId: selectedProject || undefined,
        description: description || 'Keine Beschreibung',
      });
      
      stopTimer(currentEntry.id);
      setCurrentEntry(null);
      setTimerState('idle');
      setElapsedTime(0);
      setSelectedClient('');
      setSelectedProject('');
      setDescription('');
      refreshData();
    }
  };

  const handleRestartEntry = (entry: TimeEntry) => {
    const timer = startTimer(entry.projectId || '', entry.clientId || '', entry.description);
    setCurrentEntry(timer);
    setTimerState('running');
    setSelectedClient(entry.clientId);
    setSelectedProject(entry.projectId);
    setDescription(entry.description);
    setView('dashboard');
    refreshData();
  };

  // Handle project selection while timer runs
  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    
    // Auto-update client when project changes
    const project = data.projects.find(p => p.id === projectId);
    if (project) {
      setSelectedClient(project.clientId);
      
      // Auto-save to current entry
      if (currentEntry) {
        updateTimeEntry(currentEntry.id, {
          projectId: projectId || undefined,
          clientId: project.clientId,
        });
        setCurrentEntry({
          ...currentEntry,
          projectId: projectId || undefined,
          clientId: project.clientId,
        });
      }
    } else {
      setSelectedClient('');
      if (currentEntry) {
        updateTimeEntry(currentEntry.id, { projectId: undefined, clientId: undefined });
        setCurrentEntry({
          ...currentEntry,
          projectId: undefined,
          clientId: undefined,
        });
      }
    }
  };

  // Dashboard View
  const Dashboard = () => {
    // Create a map of projects with customer names for display
    const projectsWithClients = useMemo(() => {
      return data.projects.map(project => {
        const client = data.clients.find(c => c.id === project.clientId);
        return {
          ...project,
          displayName: client ? `${project.name} (${client.name})` : project.name,
          clientName: client?.name || 'Unbekannt'
        };
      }).sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [data.projects, data.clients]);

    // Weekly goal
    const [weeklyGoal, setWeeklyGoalState] = useState(getWeeklyGoal());
    const [showGoalEditor, setShowGoalEditor] = useState(false);
    const [goalInput, setGoalInput] = useState(weeklyGoal.toString());

    // Calculate weekly progress
    const weeklyProgress = useMemo(() => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      
      const weekSeconds = data.timeEntries
        .filter(e => {
          const entryDate = new Date(e.startTime);
          return entryDate >= startOfWeek && entryDate < endOfWeek && !e.isRunning;
        })
        .reduce((sum, e) => sum + e.duration, 0);
      
      const weekHours = weekSeconds / 3600;
      const percentage = Math.min(100, (weekHours / weeklyGoal) * 100);
      
      return { hours: weekHours, percentage };
    }, [data.timeEntries, weeklyGoal]);

    const handleSaveGoal = () => {
      const newGoal = parseFloat(goalInput) || 40;
      setWeeklyGoal(newGoal);
      setWeeklyGoalState(newGoal);
      setShowGoalEditor(false);
    };

    // Recent entries (last 10 completed)
    const recentEntries = useMemo(() => {
      return [...data.timeEntries]
        .filter(e => !e.isRunning && e.endTime)
        .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())
        .slice(0, 10);
    }, [data.timeEntries]);

    return (
      <div className="dashboard">
        {/* Timer Section - Clean and minimal */}
        <div className={`timer-section ${timerState !== 'idle' ? 'active' : ''} ${timerState === 'running' ? 'pulse' : ''}`}>
          {timerState === 'idle' ? (
            <>
              <button className="btn btn-primary btn-timer-start" onClick={handleStartTimer}>
                <span className="timer-icon">▶</span>
                <span>Timer starten</span>
              </button>
              
              {/* Quick-add buttons */}
              <div className="quick-tasks">
                <span className="quick-tasks-label">Schnellstart:</span>
                <div className="quick-tasks-buttons">
                  {QUICK_TASKS.map(task => (
                    <button
                      key={task}
                      className="btn btn-sm btn-secondary quick-task-btn"
                      onClick={() => handleStartTimerWithTask(task)}
                    >
                      {task}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="timer-running">
              <div className="timer-display">{formatDuration(elapsedTime)}</div>
              <div className="timer-controls">
                {timerState === 'running' ? (
                  <button className="btn btn-secondary" onClick={handlePauseTimer}>
                    ⏸ Pause
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleResumeTimer}>
                    ▶ Weiter
                  </button>
                )}
                <button className="btn btn-danger" onClick={handleStopTimer}>
                  ■ Stoppen
                </button>
              </div>
            </div>
          )}

          {/* Timer Details Form - Always accessible */}
          {timerState !== 'idle' && (
            <div className="timer-details">
              <div className="form-group">
                <label>Projekt</label>
                <select 
                  value={selectedProject} 
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="project-select"
                >
                  <option value="">Projekt wählen...</option>
                  {projectsWithClients.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Beschreibung <span className="auto-save-hint">(auto-gespeichert)</span></label>
                <input 
                  type="text" 
                  value={description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  placeholder="Was machst du gerade?"
                  className="description-input"
                />
              </div>
            </div>
          )}
        </div>

        {/* Weekly Goal Progress */}
        <div className="weekly-goal card">
          <div className="weekly-goal-header">
            <h3>🎯 Wochenziel</h3>
            <button className="btn btn-icon" onClick={() => setShowGoalEditor(!showGoalEditor)}>✏️</button>
          </div>
          {showGoalEditor ? (
            <div className="goal-editor">
              <input
                type="number"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                min="1"
                max="168"
                step="1"
              />
              <span>Stunden/Woche</span>
              <button className="btn btn-primary btn-sm" onClick={handleSaveGoal}>Speichern</button>
            </div>
          ) : (
            <>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${weeklyProgress.percentage}%` }}
                />
              </div>
              <div className="progress-stats">
                <span>{weeklyProgress.hours.toFixed(1)}h / {weeklyGoal}h</span>
                <span>{Math.round(weeklyProgress.percentage)}%</span>
              </div>
            </>
          )}
        </div>

        {/* Recent Entries */}
        {recentEntries.length > 0 && (
          <div className="recent-entries card">
            <h3>📋 Kürzliche Zeiteinträge</h3>
            <div className="recent-list">
              {recentEntries.map(entry => {
                const client = data.clients.find(c => c.id === entry.clientId);
                const project = data.projects.find(p => p.id === entry.projectId);
                
                return (
                  <div key={entry.id} className="recent-item">
                    <div className="recent-item-info">
                      <div className="recent-item-title">{entry.description}</div>
                      <div className="recent-item-meta">
                        {client?.name} • {project?.name} • {formatDurationShort(entry.duration)}
                      </div>
                    </div>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => handleRestartEntry(entry)}
                    >
                      🔄 Neu starten
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Clients View with CRM-style Project Integration
  const ClientsView = () => {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Client | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
    
    // Project form state
    const [showProjectForm, setShowProjectForm] = useState<string | null>(null);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [projectFormData, setProjectFormData] = useState({ name: '', description: '', hourlyRate: '' });

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

    // Project handlers
    const handleProjectSubmit = (clientId: string) => (e: React.FormEvent) => {
      e.preventDefault();
      const projectData = {
        clientId,
        name: projectFormData.name,
        description: projectFormData.description,
        hourlyRate: projectFormData.hourlyRate ? parseFloat(projectFormData.hourlyRate) : undefined,
      };
      if (editingProject) {
        updateProject(editingProject.id, projectData);
      } else {
        addProject(projectData);
      }
      setShowProjectForm(null);
      setEditingProject(null);
      setProjectFormData({ name: '', description: '', hourlyRate: '' });
      refreshData();
    };

    const handleEditProject = (project: Project) => {
      setEditingProject(project);
      setProjectFormData({
        name: project.name,
        description: project.description || '',
        hourlyRate: project.hourlyRate?.toString() || '',
      });
      setShowProjectForm(project.clientId);
    };

    const handleDeleteProject = (id: string) => {
      if (confirm('Projekt wirklich löschen? Alle Zeiteinträge werden auch gelöscht.')) {
        deleteProject(id);
        refreshData();
      }
    };

    return (
      <div className="clients-view">
        <div className="view-header">
          <h2>Kunden & Projekte</h2>
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

        <div className="crm-list">
          {data.clients.map(client => {
            const clientProjects = data.projects.filter(p => p.clientId === client.id);
            
            return (
              <div key={client.id} className="crm-client-card">
                <div className="crm-client-header">
                  <div className="crm-client-info">
                    <div className="crm-client-name">{client.name}</div>
                    {client.email && <div className="crm-client-contact">✉ {client.email}</div>}
                    {client.phone && <div className="crm-client-contact">☎ {client.phone}</div>}
                  </div>
                  <div className="crm-client-actions">
                    <button className="btn btn-icon" onClick={() => handleEdit(client)}>✏️</button>
                    <button className="btn btn-icon btn-danger" onClick={() => handleDelete(client.id)}>🗑️</button>
                  </div>
                </div>

                {/* Projects Section */}
                <div className="crm-projects">
                  <div className="crm-projects-header">
                    <span className="crm-projects-title">📁 Projekte ({clientProjects.length})</span>
                    <button 
                      className="btn btn-sm btn-secondary" 
                      onClick={() => setShowProjectForm(showProjectForm === client.id ? null : client.id)}
                    >
                      + Projekt
                    </button>
                  </div>

                  {showProjectForm === client.id && (
                    <form className="project-form-inline" onSubmit={handleProjectSubmit(client.id)}>
                      <input 
                        type="text" 
                        placeholder="Projektname"
                        value={projectFormData.name}
                        onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                        required
                      />
                      <input 
                        type="text" 
                        placeholder="Beschreibung"
                        value={projectFormData.description}
                        onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                      />
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="Stundensatz €"
                        value={projectFormData.hourlyRate}
                        onChange={(e) => setProjectFormData({ ...projectFormData, hourlyRate: e.target.value })}
                      />
                      <div className="project-form-actions">
                        <button type="submit" className="btn btn-primary btn-sm">Speichern</button>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setShowProjectForm(null);
                            setEditingProject(null);
                            setProjectFormData({ name: '', description: '', hourlyRate: '' });
                          }}
                        >
                          Abbrechen
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="crm-projects-list">
                    {clientProjects.map(project => {
                      const timeEntries = data.timeEntries.filter(e => e.projectId === project.id);
                      const totalSeconds = timeEntries.reduce((sum, e) => sum + e.duration, 0);
                      
                      return (
                        <div key={project.id} className="crm-project-item">
                          <div className="crm-project-info">
                            <div className="crm-project-name">{project.name}</div>
                            {project.hourlyRate && (
                              <div className="crm-project-rate">{formatCurrency(project.hourlyRate)}/h</div>
                            )}
                          </div>
                          <div className="crm-project-meta">
                            <span>⏱️ {formatDurationShort(totalSeconds)}</span>
                            <div className="crm-project-actions">
                              <button className="btn btn-icon" onClick={() => handleEditProject(project)}>✏️</button>
                              <button className="btn btn-icon btn-danger" onClick={() => handleDeleteProject(project.id)}>🗑️</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {clientProjects.length === 0 && (
                      <div className="crm-projects-empty">Noch keine Projekte</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {data.clients.length === 0 && <div className="empty">Noch keine Kunden vorhanden</div>}
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
        clientId: entry.clientId || '',
        projectId: entry.projectId || '',
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

  // Monthly Reports View with Customer Selection
  const ReportsView = () => {
    const [selectedMonth, setSelectedMonth] = useState(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                       'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    const monthEntries = useMemo(() => {
      const [year, month] = selectedMonth.split('-').map(Number);
      return data.timeEntries.filter(entry => {
        const entryDate = new Date(entry.startTime);
        return entryDate.getFullYear() === year && entryDate.getMonth() === month - 1 && !entry.isRunning;
      });
    }, [data.timeEntries, selectedMonth]);

    const customerReports = useMemo(() => {
      const reports = new Map<string, {
        client: Client;
        totalSeconds: number;
        billableAmount: number;
        projects: Map<string, {
          project: Project;
          seconds: number;
          amount: number;
        }>;
      }>();

      monthEntries.forEach(entry => {
        const client = data.clients.find(c => c.id === entry.clientId);
        const project = data.projects.find(p => p.id === entry.projectId);
        
        if (!client) return;

        if (!reports.has(client.id)) {
          reports.set(client.id, {
            client,
            totalSeconds: 0,
            billableAmount: 0,
            projects: new Map(),
          });
        }

        const report = reports.get(client.id)!;
        const hours = entry.duration / 3600;
        const rate = project?.hourlyRate || 0;
        const amount = hours * rate;

        report.totalSeconds += entry.duration;
        report.billableAmount += amount;

        if (project) {
          if (!report.projects.has(project.id)) {
            report.projects.set(project.id, {
              project,
              seconds: 0,
              amount: 0,
            });
          }
          const projReport = report.projects.get(project.id)!;
          projReport.seconds += entry.duration;
          projReport.amount += amount;
        }
      });

      return Array.from(reports.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
    }, [monthEntries, data.clients, data.projects]);

    // Filter reports by selected customer
    const filteredReports = useMemo(() => {
      if (!selectedCustomerId) return customerReports;
      return customerReports.filter(r => r.client.id === selectedCustomerId);
    }, [customerReports, selectedCustomerId]);

    const totalMonthSeconds = filteredReports.reduce((sum, r) => sum + r.totalSeconds, 0);
    const totalMonthAmount = filteredReports.reduce((sum, r) => sum + r.billableAmount, 0);

    // Daily and weekly summaries
    const timeSummaries = useMemo(() => {
      const now = new Date();
      const today = now.toDateString();
      
      // Today
      const todaySeconds = data.timeEntries
        .filter(e => new Date(e.startTime).toDateString() === today && !e.isRunning)
        .reduce((sum, e) => sum + e.duration, 0);
      
      // This week (Monday to Sunday)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      
      const weekSeconds = data.timeEntries
        .filter(e => {
          const entryDate = new Date(e.startTime);
          return entryDate >= startOfWeek && entryDate < endOfWeek && !e.isRunning;
        })
        .reduce((sum, e) => sum + e.duration, 0);
      
      // Per day breakdown for current week
      const weekDays: { day: string; hours: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + i);
        const dayString = dayDate.toDateString();
        const daySeconds = data.timeEntries
          .filter(e => new Date(e.startTime).toDateString() === dayString && !e.isRunning)
          .reduce((sum, e) => sum + e.duration, 0);
        
        const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        weekDays.push({
          day: dayNames[dayDate.getDay()],
          hours: daySeconds / 3600
        });
      }
      
      return {
        today: todaySeconds / 3600,
        week: weekSeconds / 3600,
        weekDays
      };
    }, [data.timeEntries]);

    const handleExportHTML = () => {
      const html = exportToHTML(selectedMonth, filteredReports, totalMonthSeconds, totalMonthAmount);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const [year, month] = selectedMonth.split('-');
      link.setAttribute('href', url);
      link.setAttribute('download', `report_${year}_${month}.html`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const handleExportCustomerHTML = () => {
      if (!selectedCustomerId) {
        alert('Bitte wählen Sie einen Kunden aus');
        return;
      }
      
      const report = filteredReports[0];
      if (!report) return;
      
      const html = exportCustomerToHTML(selectedMonth, report);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const [year, month] = selectedMonth.split('-');
      link.setAttribute('href', url);
      link.setAttribute('download', `report_${report.client.name}_${year}_${month}.html`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
      const [year, month] = selectedMonth.split('-').map(Number);
      const date = new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1);
      setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    return (
      <div className="reports-view">
        <div className="view-header">
          <h2>Monatsübersicht</h2>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={handleExportHTML}>📄 Alle Exportieren</button>
            {selectedCustomerId && (
              <button className="btn btn-primary" onClick={handleExportCustomerHTML}>📄 Kunden Export</button>
            )}
          </div>
        </div>

        {/* Daily/Weekly Summaries */}
        <div className="time-summaries card">
          <h3>⏱️ Zeitzusammenfassung</h3>
          <div className="summary-grid-2">
            <div className="summary-item highlight">
              <div className="summary-value">{timeSummaries.today.toFixed(1)}h</div>
              <div className="summary-label">Heute</div>
            </div>
            <div className="summary-item highlight">
              <div className="summary-value">{timeSummaries.week.toFixed(1)}h</div>
              <div className="summary-label">Diese Woche</div>
            </div>
          </div>
          
          {/* Weekly breakdown */}
          <div className="week-breakdown">
            {timeSummaries.weekDays.map((day, idx) => (
              <div key={idx} className="week-day">
                <div className="week-day-label">{day.day}</div>
                <div className="week-day-bar-container">
                  <div 
                    className="week-day-bar" 
                    style={{ 
                      height: `${Math.min(100, (day.hours / 8) * 100)}%`,
                      backgroundColor: day.hours >= 8 ? 'var(--success)' : 'var(--primary)'
                    }}
                  />
                </div>
                <div className="week-day-value">{day.hours.toFixed(1)}h</div>
              </div>
            ))}
          </div>
        </div>

        {/* Month Selector */}
        <div className="month-selector card">
          <button className="btn btn-icon" onClick={() => navigateMonth('prev')}>◀</button>
          <div className="month-display">
            {monthNames[parseInt(selectedMonth.split('-')[1]) - 1]} {selectedMonth.split('-')[0]}
          </div>
          <button className="btn btn-icon" onClick={() => navigateMonth('next')}>▶</button>
        </div>

        {/* Customer Selector */}
        <div className="customer-selector card">
          <div className="form-group">
            <label>Kundenfilter</label>
            <select 
              value={selectedCustomerId} 
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="">Alle Kunden</option>
              {data.clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="reports-summary card">
          <div className="summary-grid">
            <div className="summary-item">
              <div className="summary-value">{formatDurationShort(totalMonthSeconds)}</div>
              <div className="summary-label">Gesamtstunden</div>
            </div>
            <div className="summary-item">
              <div className="summary-value">{formatCurrency(totalMonthAmount)}</div>
              <div className="summary-label">Rechnungsbetrag</div>
            </div>
            <div className="summary-item">
              <div className="summary-value">{filteredReports.length}</div>
              <div className="summary-label">Kunden</div>
            </div>
          </div>
        </div>

        <div className="reports-list">
          {filteredReports.map(report => (
            <div key={report.client.id} className="report-card card">
              <div className="report-header">
                <div className="report-client">{report.client.name}</div>
                <div className="report-totals">
                  <span className="report-hours">{formatDurationShort(report.totalSeconds)}</span>
                  <span className="report-amount">{formatCurrency(report.billableAmount)}</span>
                </div>
              </div>
              
              <div className="report-projects">
                {Array.from(report.projects.values()).map(proj => (
                  <div key={proj.project.id} className="report-project">
                    <span className="report-project-name">{proj.project.name}</span>
                    <span className="report-project-hours">{formatDurationShort(proj.seconds)}</span>
                    {proj.project.hourlyRate ? (
                      <span className="report-project-amount">{formatCurrency(proj.amount)}</span>
                    ) : (
                      <span className="report-project-no-rate">-</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {filteredReports.length === 0 && (
            <div className="empty">Keine Zeiteinträge für diesen Monat</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>⏱️ TimeTracker</h1>
        <button 
          className="dark-mode-toggle" 
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Light Mode' : 'Dark Mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </header>

      <nav className="nav">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
          📊 Dashboard
        </button>
        <button className={view === 'clients' ? 'active' : ''} onClick={() => setView('clients')}>
          👥 Kunden
        </button>
        <button className={view === 'time-entries' ? 'active' : ''} onClick={() => setView('time-entries')}>
          ⏱️ Zeiten
        </button>
        <button className={view === 'reports' ? 'active' : ''} onClick={() => setView('reports')}>
          📈 Reports
        </button>
      </nav>

      <main className="main">
        {view === 'dashboard' && <Dashboard />}
        {view === 'clients' && <ClientsView />}
        {view === 'time-entries' && <TimeEntriesView />}
        {view === 'reports' && <ReportsView />}
      </main>
    </div>
  );
}

export default App;
