export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  hourlyRate?: number;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  projectId?: string;
  clientId?: string;
  description: string;
  startTime: string;
  endTime?: string;
  duration: number; // in seconds
  isRunning: boolean;
  createdAt: string;
}

export interface AppData {
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
}