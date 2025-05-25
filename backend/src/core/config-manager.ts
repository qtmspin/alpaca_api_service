/**
 * config-manager.ts
 * 
 * This file contains the implementation for managing service configuration.
 * It handles loading, validating, and updating configuration settings.
 * Location: backend/src/core/config-manager.ts
 * 
 * Responsibilities:
 * - Load configuration from file or environment variables
 * - Validate configuration using Zod schemas
 * - Provide methods to update runtime configuration
 * - Notify subscribers when configuration changes
 */

import fs from 'fs/promises';
import path from 'path';
import { ServiceConfigSchema, ServiceConfig, ConfigUpdateSchema } from './schemas';

type ConfigChangeListener = (config: ServiceConfig) => void;

/**
 * ConfigManager class
 * 
 * Manages service configuration, including loading, validation, and updates.
 * Separates runtime settings (can be changed without restart) from startup settings.
 */
export class ConfigManager {
  private config: ServiceConfig;
  private configPath: string;
  private listeners: ConfigChangeListener[] = [];
  
  /**
   * Constructor for ConfigManager
   * @param configPath - Path to the configuration file
   */
  constructor(configPath: string) {
    this.configPath = configPath;
    
    // Initialize with default values from schema
    this.config = ServiceConfigSchema.parse({
      runtime: {},
      startup: {}
    });
  }
  
  /**
   * Load configuration from file
   * @returns Promise resolving to the loaded configuration
   */
  public async loadConfig(): Promise<ServiceConfig> {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      const fileExists = await fs.access(this.configPath)
        .then(() => true)
        .catch(() => false);
      
      if (fileExists) {
        const configData = await fs.readFile(this.configPath, 'utf-8');
        const parsedConfig = JSON.parse(configData);
        
        // Validate and set defaults for any missing fields
        this.config = ServiceConfigSchema.parse(parsedConfig);
      } else {
        // Create a new config file with defaults if it doesn't exist
        await this.saveConfig();
      }
      
      return this.config;
    } catch (error: unknown) {
      console.error('Error loading configuration:', error);
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Save configuration to file
   * @returns Promise resolving when the configuration is saved
   */
  public async saveConfig(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
    } catch (error: unknown) {
      console.error('Error saving configuration:', error);
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get the current configuration
   * @returns The current service configuration
   */
  public getConfig(): ServiceConfig {
    return this.config;
  }
  
  /**
   * Update runtime configuration settings
   * @param updates - Partial configuration updates
   * @returns The updated configuration
   */
  public async updateRuntimeConfig(updates: Record<string, any>): Promise<ServiceConfig> {
    try {
      // Validate the updates against the schema
      const validatedUpdates = ConfigUpdateSchema.parse(updates);
      
      // Only allow updating runtime settings
      if (validatedUpdates.runtime) {
        this.config = {
          ...this.config,
          runtime: {
            ...this.config.runtime,
            ...validatedUpdates.runtime
          }
        };
        
        // Save the updated configuration
        await this.saveConfig();
        
        // Notify listeners of the change
        this.notifyListeners();
      }
      
      return this.config;
    } catch (error: unknown) {
      console.error('Error updating configuration:', error);
      throw new Error(`Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Subscribe to configuration changes
   * @param listener - Function to call when configuration changes
   * @returns Unsubscribe function
   */
  public subscribe(listener: ConfigChangeListener): () => void {
    this.listeners.push(listener);
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.config);
    }
  }
}
