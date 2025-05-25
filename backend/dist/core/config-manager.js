"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const schemas_1 = require("./schemas");
/**
 * ConfigManager class
 *
 * Manages service configuration, including loading, validation, and updates.
 * Separates runtime settings (can be changed without restart) from startup settings.
 */
class ConfigManager {
    /**
     * Constructor for ConfigManager
     * @param configPath - Path to the configuration file
     */
    constructor(configPath) {
        this.listeners = [];
        this.configPath = configPath;
        // Initialize with default values from schema
        this.config = schemas_1.ServiceConfigSchema.parse({
            runtime: {},
            startup: {}
        });
    }
    /**
     * Load configuration from file
     * @returns Promise resolving to the loaded configuration
     */
    async loadConfig() {
        try {
            const configDir = path_1.default.dirname(this.configPath);
            await promises_1.default.mkdir(configDir, { recursive: true });
            const fileExists = await promises_1.default.access(this.configPath)
                .then(() => true)
                .catch(() => false);
            if (fileExists) {
                const configData = await promises_1.default.readFile(this.configPath, 'utf-8');
                const parsedConfig = JSON.parse(configData);
                // Validate and set defaults for any missing fields
                this.config = schemas_1.ServiceConfigSchema.parse(parsedConfig);
            }
            else {
                // Create a new config file with defaults if it doesn't exist
                await this.saveConfig();
            }
            return this.config;
        }
        catch (error) {
            console.error('Error loading configuration:', error);
            throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Save configuration to file
     * @returns Promise resolving when the configuration is saved
     */
    async saveConfig() {
        try {
            const configDir = path_1.default.dirname(this.configPath);
            await promises_1.default.mkdir(configDir, { recursive: true });
            await promises_1.default.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('Error saving configuration:', error);
            throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get the current configuration
     * @returns The current service configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Update runtime configuration settings
     * @param updates - Partial configuration updates
     * @returns The updated configuration
     */
    async updateRuntimeConfig(updates) {
        try {
            // Validate the updates against the schema
            const validatedUpdates = schemas_1.ConfigUpdateSchema.parse(updates);
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
        }
        catch (error) {
            console.error('Error updating configuration:', error);
            throw new Error(`Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Subscribe to configuration changes
     * @param listener - Function to call when configuration changes
     * @returns Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    /**
     * Notify all listeners of configuration changes
     */
    notifyListeners() {
        for (const listener of this.listeners) {
            listener(this.config);
        }
    }
}
exports.ConfigManager = ConfigManager;
