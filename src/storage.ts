import type { AppData, Client, Project, TimeEntry } from './types';

const STORAGE_KEY = 'timetracker_data';

export const defaultData: AppData = {
  clients: [],
  projects: [],
  timeEntries: [],
};

export function loadData(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultData, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load data from localStorage:', error);
  }
  return defaultData;
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save data to localStorage:', error);
  }
}

// Client operations
export function addClient(client: Omit<Client, 'id' | 'createdAt'>): Client {
  const data = loadData();
  const newClient: Client = {
    ...client,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  data.clients.push(newClient);
  saveData(data);
  return newClient;
}

export function updateClient(id: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>): Client | null {
  const data = loadData();
  const index = data.clients.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  data.clients[index] = { ...data.clients[index], ...updates };
  saveData(data);
  return data.clients[index];
}

export function deleteClient(id: string): boolean {
  const data = loadData();
  const initialLength = data.clients.length;
  data.clients = data.clients.filter(c => c.id !== id);
  
  // Also delete associated projects and time entries
  const projectsToDelete = data.projects.filter(p => p.clientId === id).map(p => p.id);
  data.projects = data.projects.filter(p => p.clientId !== id);
  data.timeEntries = data.timeEntries.filter(e => !projectsToDelete.includes(e.projectId) && e.clientId !== id);
  
  if (data.clients.length < initialLength) {
    saveData(data);
    return true;
  }
  return false;
}

// Project operations
export function addProject(project: Omit<Project, 'id' | 'createdAt'>): Project {
  const data = loadData();
  const newProject: Project = {
    ...project,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  data.projects.push(newProject);
  saveData(data);
  return newProject;
}

export function updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null {
  const data = loadData();
  const index = data.projects.findIndex(p => p.id === id);
  if (index === -1) return null;
  
  data.projects[index] = { ...data.projects[index], ...updates };
  saveData(data);
  return data.projects[index];
}

export function deleteProject(id: string): boolean {
  const data = loadData();
  const initialLength = data.projects.length;
  data.projects = data.projects.filter(p => p.id !== id);
  data.timeEntries = data.timeEntries.filter(e => e.projectId !== id);
  
  if (data.projects.length < initialLength) {
    saveData(data);
    return true;
  }
  return false;
}

// Time entry operations
export function addTimeEntry(entry: Omit<TimeEntry, 'id' | 'createdAt'>): TimeEntry {
  const data = loadData();
  const newEntry: TimeEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  data.timeEntries.push(newEntry);
  saveData(data);
  return newEntry;
}

export function updateTimeEntry(id: string, updates: Partial<Omit<TimeEntry, 'id' | 'createdAt'>>): TimeEntry | null {
  const data = loadData();
  const index = data.timeEntries.findIndex(e => e.id === id);
  if (index === -1) return null;
  
  data.timeEntries[index] = { ...data.timeEntries[index], ...updates };
  saveData(data);
  return data.timeEntries[index];
}

export function deleteTimeEntry(id: string): boolean {
  const data = loadData();
  const initialLength = data.timeEntries.length;
  data.timeEntries = data.timeEntries.filter(e => e.id !== id);
  
  if (data.timeEntries.length < initialLength) {
    saveData(data);
    return true;
  }
  return false;
}

export function startTimer(projectId: string, clientId: string, description: string): TimeEntry {
  // Stop any running timers first
  stopAllRunningTimers();
  
  const now = new Date().toISOString();
  return addTimeEntry({
    projectId,
    clientId,
    description,
    startTime: now,
    duration: 0,
    isRunning: true,
  });
}

export function stopTimer(entryId: string): TimeEntry | null {
  const data = loadData();
  const entry = data.timeEntries.find(e => e.id === entryId);
  if (!entry || !entry.isRunning) return null;
  
  const now = new Date();
  const startTime = new Date(entry.startTime);
  const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000) + entry.duration;
  
  return updateTimeEntry(entryId, {
    endTime: now.toISOString(),
    duration,
    isRunning: false,
  });
}

export function stopAllRunningTimers(): void {
  const data = loadData();
  const now = new Date();
  
  data.timeEntries.forEach(entry => {
    if (entry.isRunning) {
      const startTime = new Date(entry.startTime);
      const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000) + entry.duration;
      entry.endTime = now.toISOString();
      entry.duration = duration;
      entry.isRunning = false;
    }
  });
  
  saveData(data);
}

export function getRunningTimer(): TimeEntry | null {
  const data = loadData();
  return data.timeEntries.find(e => e.isRunning) || null;
}

// CSV Export
export function exportToCSV(): string {
  const data = loadData();
  
  const headers = ['Datum', 'Kunde', 'Projekt', 'Beschreibung', 'Start', 'Ende', 'Dauer (h)', 'Dauer (Std:Min)'];
  
  const rows = data.timeEntries.map(entry => {
    const client = data.clients.find(c => c.id === entry.clientId);
    const project = data.projects.find(p => p.id === entry.projectId);
    
    const date = new Date(entry.startTime).toLocaleDateString('de-DE');
    const startTime = new Date(entry.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const endTime = entry.endTime 
      ? new Date(entry.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : '-';
    
    const hours = (entry.duration / 3600).toFixed(2);
    const hoursInt = Math.floor(entry.duration / 3600);
    const mins = Math.floor((entry.duration % 3600) / 60);
    const formattedDuration = `${hoursInt}:${mins.toString().padStart(2, '0')}`;
    
    return [
      date,
      client?.name || 'Unbekannt',
      project?.name || 'Unbekannt',
      entry.description,
      startTime,
      endTime,
      hours,
      formattedDuration,
    ];
  });
  
  // Sort by date descending
  rows.sort((a, b) => {
    const dateA = new Date(a[0].split('.').reverse().join('-'));
    const dateB = new Date(b[0].split('.').reverse().join('-'));
    return dateB.getTime() - dateA.getTime();
  });
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  
  return csvContent;
}

export function downloadCSV(): void {
  const csv = exportToCSV();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `zeiterfassung_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
