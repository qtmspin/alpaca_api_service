/**
 * config-manager.ts
 *
 * This file manages application configuration loading and validation.
 * Location: backend/src/core/config-manager.ts
 *
 * Responsibilities:
 * - Load configuration from JSON files
 * - Validate configuration using Zod schemas
 * - Provide type-safe configuration access
 * - Handle configuration updates
 */
import fs from 'fs/promises';
import path from 'path';
import { AppConfigSchema } from './schemas.js';
export class ConfigManager {
    constructor(configPath) {
        this.config = null;
        this.configPath = path.resolve(configPath);
    }
    /**
     * Load configuration from file
     */
    async loadConfig() {
        try {
            // Check if config file exists
            await fs.access(this.configPath);
            // Read and parse config file
            const configData = await fs.readFile(this.configPath, 'utf-8');
            const rawConfig = JSON.parse(configData);
            // Validate configuration using Zod schema
            const validatedConfig = AppConfigSchema.parse(rawConfig);
            this.config = validatedConfig;
            return validatedConfig;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                throw new Error(`Configuration file not found: ${this.configPath}`);
            }
            throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get current configuration
     */
    getConfig() {
        if (!this.config) {
            throw new Error('Configuration not loaded. Call loadConfig() first.');
        }
        return this.config;
    }
    /**
     * Save configuration to file
     */
    async saveConfig(config) {
        try {
            // Validate configuration
            const validatedConfig = AppConfigSchema.parse(config);
            // Ensure directory exists
            const configDir = path.dirname(this.configPath);
            await fs.mkdir(configDir, { recursive: true });
            // Write configuration to file
            await fs.writeFile(this.configPath, JSON.stringify(validatedConfig, null, 2), 'utf-8');
            this.config = validatedConfig;
        }
        catch (error) {
            throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Update specific configuration section
     */
    async updateConfig(updates) {
        const currentConfig = this.getConfig();
        const newConfig = { ...currentConfig, ...updates };
        await this.saveConfig(newConfig);
        return newConfig;
    }
    /**
     * Update runtime configuration section only
     * @param updates - Partial runtime configuration updates
     * @returns Updated application configuration
     */
    async updateRuntimeConfig(updates) {
        const currentConfig = this.getConfig();
        const newConfig = {
            ...currentConfig,
            runtime: { ...currentConfig.runtime, ...updates }
        };
        await this.saveConfig(newConfig);
        return newConfig;
    }
    /**
     * Create default configuration file
     */
    async createDefaultConfig() {
        const defaultConfig = {
            startup: {
                apiPort: 9000,
                wsPort: 9001,
                host: 'localhost'
            },
            runtime: {
                alpaca: {
                    apiKey: process.env.ALPACA_API_KEY || '',
                    secretKey: process.env.ALPACA_SECRET_KEY || '',
                    isPaper: true,
                    baseUrl: 'https://paper-api.alpaca.markets'
                },
                monitoring: {
                    priceCheckIntervalMs: 5000,
                    maxRetries: 3,
                    retryDelayMs: 1000
                },
                rateLimits: {
                    orders: 200,
                    data: 500
                }
            }
        };
        await this.saveConfig(defaultConfig);
        return defaultConfig;
    }
    /**
     * Check if configuration file exists
     */
    async configExists() {
        try {
            await fs.access(this.configPath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get configuration file path
     */
    getConfigPath() {
        return this.configPath;
    }
}
