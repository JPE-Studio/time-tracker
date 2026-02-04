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

export function pauseTimer(entryId: string): TimeEntry | null {
  const data = loadData();
  const entry = data.timeEntries.find(e => e.id === entryId);
  if (!entry || !entry.isRunning) return null;
  
  const now = new Date();
  const startTime = new Date(entry.startTime);
  const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000) + entry.duration;
  
  return updateTimeEntry(entryId, {
    duration,
    isRunning: false,
  });
}

export function resumeTimer(entryId: string): TimeEntry | null {
  const data = loadData();
  const entry = data.timeEntries.find(e => e.id === entryId);
  if (!entry || entry.isRunning) return null;
  
  // Stop any other running timers
  stopAllRunningTimers();
  
  const now = new Date();
  return updateTimeEntry(entryId, {
    startTime: now.toISOString(),
    isRunning: true,
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

// HTML Report Export
interface ClientReport {
  client: Client;
  totalSeconds: number;
  billableAmount: number;
  projects: Map<string, {
    project: Project;
    seconds: number;
    amount: number;
  }>;
}

export function exportToHTML(
  selectedMonth: string,
  clientReports: ClientReport[],
  totalMonthSeconds: number,
  totalMonthAmount: number
): string {
  const [year, month] = selectedMonth.split('-');
  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                     'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const monthName = monthNames[parseInt(month) - 1];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDurationShort = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const totalHours = (totalMonthSeconds / 3600).toFixed(2);

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zeiterfassung ${monthName} ${year}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f3f4f6;
      color: #1f2937;
      line-height: 1.5;
      padding: 2rem;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 1.75rem;
      color: #2563eb;
      margin-bottom: 0.5rem;
    }
    .header-date {
      color: #6b7280;
      font-size: 1.125rem;
    }
    .summary {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      color: white;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
    }
    .summary-item {
      text-align: center;
    }
    .summary-value {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }
    .summary-label {
      font-size: 0.875rem;
      opacity: 0.9;
    }
    .client-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .client-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .client-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
    }
    .client-totals {
      text-align: right;
    }
    .client-hours {
      font-size: 1.25rem;
      font-weight: 600;
      color: #2563eb;
    }
    .client-amount {
      font-size: 1rem;
      color: #16a34a;
      font-weight: 500;
    }
    .projects-table {
      width: 100%;
      border-collapse: collapse;
    }
    .projects-table th,
    .projects-table td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .projects-table th {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      font-weight: 600;
    }
    .projects-table td {
      font-size: 0.875rem;
    }
    .text-right {
      text-align: right;
    }
    .no-rate {
      color: #9ca3af;
    }
    .footer {
      text-align: center;
      color: #6b7280;
      font-size: 0.875rem;
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
    }
    @media print {
      body { background: white; padding: 0; }
      .header, .summary, .client-card { box-shadow: none; border: 1px solid #e5e7eb; }
    }
    @media (max-width: 640px) {
      body { padding: 1rem; }
      .summary-grid { grid-template-columns: 1fr; gap: 1rem; }
      .client-header { flex-direction: column; align-items: flex-start; }
      .client-totals { text-align: left; margin-top: 0.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏱️ Zeiterfassungsreport</h1>
      <div class="header-date">${monthName} ${year}</div>
    </div>
    
    <div class="summary">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${totalHours}h</div>
          <div class="summary-label">Gesamtstunden</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${formatCurrency(totalMonthAmount)}</div>
          <div class="summary-label">Rechnungsbetrag</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${clientReports.length}</div>
          <div class="summary-label">Kunden</div>
        </div>
      </div>
    </div>

    ${clientReports.map(report => `
    <div class="client-card">
      <div class="client-header">
        <div class="client-name">${report.client.name}</div>
        <div class="client-totals">
          <div class="client-hours">${formatDurationShort(report.totalSeconds)}</div>
          <div class="client-amount">${formatCurrency(report.billableAmount)}</div>
        </div>
      </div>
      <table class="projects-table">
        <thead>
          <tr>
            <th>Projekt</th>
            <th class="text-right">Stunden</th>
            <th class="text-right">Betrag</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from(report.projects.values()).map(proj => `
          <tr>
            <td>${proj.project.name}</td>
            <td class="text-right">${formatDurationShort(proj.seconds)}</td>
            <td class="text-right">${proj.project.hourlyRate ? formatCurrency(proj.amount) : '<span class="no-rate">-</span>'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `).join('')}

    <div class="footer">
      Generiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'})}
    </div>
  </div>
</body>
</html>`;

  return html;
}