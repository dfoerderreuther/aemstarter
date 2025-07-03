import { Project } from '../../types/Project';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { ProjectSettingsService } from './ProjectSettingsService';

export class ProjectManager {
  private projects: Project[] = [];
  private readonly projectsFilePath: string;
  private readonly settingsFilePath: string;
  private settings: { 
    lastProjectId?: string;
    aemSdkPath?: string;
    licensePath?: string;
  } = {};

  constructor() {
    // Store projects in user's app data directory using Electron's userData path
    const appDataPath = app.getPath('userData');
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
        
        // Load settings for each existing project
        this.projects = this.projects.map(project => this.loadProjectSettings(project));
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      this.projects = [];
    }
  }

  private loadProjectSettings(project: Project): Project {
    try {
      const settings = ProjectSettingsService.getSettings(project);
      return {
        ...project,
        settings
      };
    } catch (error) {
      console.error('Error loading settings for project:', project.name, error);
      return {
        ...project,
        settings: ProjectSettingsService.getDefaultSettings(project)
      };
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

  getProject(id: string): Project | undefined {
    return this.projects.find(p => p.id === id);
  }

  getAllProjects(): Project[] {
    return this.projects;
  }

  createProject(name: string, folderPath: string, aemSdkPath: string, licensePath: string, classic: boolean = false, classicQuickstartPath: string = ''): Project {
    // Validate file types
    if (!aemSdkPath.toLowerCase().endsWith('.zip')) {
      throw new Error('AEM SDK path must be a .zip file');
    }
    if (licensePath && !licensePath.toLowerCase().endsWith('.properties')) {
      throw new Error('License path must be a .properties file');
    }
    if (classic && !classicQuickstartPath.toLowerCase().endsWith('.jar')) {
      throw new Error('Classic quickstart path must be a .jar file');
    }

    // Validate files exist
    if (!fs.existsSync(aemSdkPath)) {
      throw new Error('AEM SDK file does not exist');
    }
    if (licensePath && !fs.existsSync(licensePath)) {
      throw new Error('License file does not exist');
    }
    if (classic && !fs.existsSync(classicQuickstartPath)) {
      throw new Error('Classic quickstart file does not exist');
    }
    if (classic && !licensePath) {
      throw new Error('License file is required for classic AEM versions');
    }

    const project: Project = {
      id: uuidv4(),
      name,
      folderPath,
      aemSdkPath,
      licensePath,
      createdAt: new Date(),
      lastModified: new Date(),
      classic,
      classicQuickstartPath,
      settings: ProjectSettingsService.getDefaultSettings({
        id: uuidv4(),
        name,
        folderPath,
        aemSdkPath,
        licensePath,
        createdAt: new Date(),
        lastModified: new Date(),
        classic,
        classicQuickstartPath,
        settings: {} as any // Temporary placeholder
      })
    };

    this.projects.push(project);
    this.saveProjects();
    return project;
  }

  importProject(name: string, folderPath: string): Project {
    // Validate that the folder exists
    if (!fs.existsSync(folderPath)) {
      throw new Error('Project folder does not exist');
    }

    const project: Project = {
      id: uuidv4(),
      name,
      folderPath,
      aemSdkPath: '', // Not needed for existing installations
      licensePath: '', // Not needed for existing installations
      createdAt: new Date(),
      lastModified: new Date(),
      classic: false,
      classicQuickstartPath: '',
      settings: ProjectSettingsService.getDefaultSettings({
        id: uuidv4(),
        name,
        folderPath,
        aemSdkPath: '',
        licensePath: '',
        createdAt: new Date(),
        lastModified: new Date(),
        classic: false,
        classicQuickstartPath: '',
        settings: {} as any // Temporary placeholder
      })
    };

    // Load settings from existing project folder if available
    const projectWithSettings = this.loadProjectSettings(project);

    this.projects.push(projectWithSettings);
    this.saveProjects();
    return projectWithSettings;
  }

  updateProject(id: string, updates: Partial<Project>): Project | undefined {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      return undefined;
    }

    const project = this.projects[index];
    const updatedProject = {
      ...project,
      ...updates,
      lastModified: new Date()
    };

    this.projects[index] = updatedProject;
    this.saveProjects();
    return updatedProject;
  }

  updateProjectSettings(id: string, settings: any): Project | undefined {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      return undefined;
    }

    const project = this.projects[index];
    const updatedProject = {
      ...project,
      name: settings.general?.name || project.name, // Sync project.name with settings.general.name
      settings,
      lastModified: new Date()
    };

    this.projects[index] = updatedProject;
    this.saveProjects();
    
    // Also save to the project's settings.json file
    try {
      ProjectSettingsService.saveSettings(updatedProject, settings);
    } catch (error) {
      console.error('Error saving project settings to file:', error);
    }

    return updatedProject;
  }

  deleteProject(id: string): boolean {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      return false;
    }

    this.projects.splice(index, 1);
    this.saveProjects();

    if (this.settings.lastProjectId === id) {
      this.settings.lastProjectId = undefined;
      this.saveSettings();
    }

    return true;
  }

  setLastProjectId(id: string | null): boolean {
    this.settings.lastProjectId = id || undefined;
    this.saveSettings();
    return true;
  }

  getLastProjectId(): string | undefined {
    return this.settings.lastProjectId;
  }

  setGlobalSettings(settings: { aemSdkPath?: string; licensePath?: string }): void {
    this.settings = {
      ...this.settings,
      ...settings
    };
    this.saveSettings();
  }

  getGlobalSettings(): { aemSdkPath?: string; licensePath?: string } {
    return {
      aemSdkPath: this.settings.aemSdkPath,
      licensePath: this.settings.licensePath
    };
  }
} 