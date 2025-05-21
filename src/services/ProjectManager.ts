import { Project } from '../types/Project';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export class ProjectManager {
  private projects: Project[] = [];
  private readonly projectsFilePath: string;
  private readonly settingsFilePath: string;
  private settings: { lastProjectId?: string } = {};

  constructor() {
    // Store projects in user's app data directory
    const userDataPath = process.env.APPDATA || 
      (process.platform === 'darwin' 
        ? process.env.HOME + '/Library/Application Support' 
        : process.env.HOME + '/.local/share');
    
    const appDataPath = path.join(userDataPath, 'aem-starter');
    this.projectsFilePath = path.join(appDataPath, 'projects.json');
    this.settingsFilePath = path.join(appDataPath, 'settings.json');
    
    this.loadProjects();
    this.loadSettings();
  }

  private loadProjects(): void {
    try {
      if (fs.existsSync(this.projectsFilePath)) {
        const data = fs.readFileSync(this.projectsFilePath, 'utf-8');
        this.projects = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      this.projects = [];
    }
  }

  private saveProjects(): void {
    try {
      const dir = path.dirname(this.projectsFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.projectsFilePath, JSON.stringify(this.projects, null, 2));
    } catch (error) {
      console.error('Error saving projects:', error);
    }
  }

  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const data = fs.readFileSync(this.settingsFilePath, 'utf-8');
        this.settings = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.settings = {};
    }
  }

  private saveSettings(): void {
    try {
      const dir = path.dirname(this.settingsFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.settingsFilePath, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  createProject(name: string, folderPath: string): Project {
    const project: Project = {
      id: uuidv4(),
      name,
      folderPath,
      createdAt: new Date(),
      lastModified: new Date()
    };

    this.projects.push(project);
    this.saveProjects();
    return project;
  }

  loadProject(id: string): Project | undefined {
    return this.projects.find(p => p.id === id);
  }

  getAllProjects(): Project[] {
    return [...this.projects];
  }

  updateProject(id: string, updates: Partial<Project>): Project | undefined {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) return undefined;

    const updatedProject = {
      ...this.projects[index],
      ...updates,
      lastModified: new Date()
    };

    this.projects[index] = updatedProject;
    this.saveProjects();
    return updatedProject;
  }

  deleteProject(id: string): boolean {
    const initialLength = this.projects.length;
    this.projects = this.projects.filter(p => p.id !== id);
    
    if (this.projects.length !== initialLength) {
      this.saveProjects();
      
      // If we're deleting the last selected project, clear the setting
      if (this.settings.lastProjectId === id) {
        this.settings.lastProjectId = undefined;
        this.saveSettings();
      }
      
      return true;
    }
    return false;
  }

  setLastProjectId(id: string | undefined): void {
    this.settings.lastProjectId = id;
    this.saveSettings();
  }

  getLastProjectId(): string | undefined {
    return this.settings.lastProjectId;
  }
} 