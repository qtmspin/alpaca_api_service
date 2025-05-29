/**
 * logger.ts
 * 
 * Centralized logging utility for the application
 * Provides consistent logging format and levels
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  enableTimestamp: boolean;
  enableColors: boolean;
}

/**
 * Logger class for centralized logging
 */
class Logger {
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    enableTimestamp: true,
    enableColors: true
  };
  
  /**
   * Set the log level
   * @param level Minimum log level to display
   */
  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }
  
  /**
   * Enable or disable timestamps in logs
   * @param enable Whether to enable timestamps
   */
  public enableTimestamp(enable: boolean): void {
    this.config.enableTimestamp = enable;
  }
  
  /**
   * Enable or disable colors in logs
   * @param enable Whether to enable colors
   */
  public enableColors(enable: boolean): void {
    this.config.enableColors = enable;
  }
  
  /**
   * Log a debug message
   * @param message Message to log
   * @param data Optional data to include
   */
  public debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }
  
  /**
   * Log an info message
   * @param message Message to log
   * @param data Optional data to include
   */
  public info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }
  
  /**
   * Log a warning message
   * @param message Message to log
   * @param data Optional data to include
   */
  public warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }
  
  /**
   * Log an error message
   * @param message Message to log
   * @param data Optional data to include
   */
  public error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }
  
  /**
   * Internal log method
   * @param level Log level
   * @param message Message to log
   * @param data Optional data to include
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.config.level) {
      return;
    }
    
    const timestamp = this.config.enableTimestamp ? new Date().toISOString() : '';
    const prefix = this.getPrefix(level);
    
    if (data !== undefined) {
      if (data instanceof Error) {
        console.log(`${timestamp} ${prefix} ${message}:`, data.message);
        if (data.stack) {
          console.log(data.stack);
        }
      } else {
        console.log(`${timestamp} ${prefix} ${message}:`, data);
      }
    } else {
      console.log(`${timestamp} ${prefix} ${message}`);
    }
  }
  
  /**
   * Get the prefix for a log level
   * @param level Log level
   * @returns Formatted prefix
   */
  private getPrefix(level: LogLevel): string {
    if (!this.config.enableColors) {
      switch (level) {
        case LogLevel.DEBUG: return '[DEBUG]';
        case LogLevel.INFO: return '[INFO]';
        case LogLevel.WARN: return '[WARN]';
        case LogLevel.ERROR: return '[ERROR]';
        default: return '';
      }
    }
    
    // With colors
    switch (level) {
      case LogLevel.DEBUG: return '\x1b[36m[DEBUG]\x1b[0m'; // Cyan
      case LogLevel.INFO: return '\x1b[32m[INFO]\x1b[0m';   // Green
      case LogLevel.WARN: return '\x1b[33m[WARN]\x1b[0m';   // Yellow
      case LogLevel.ERROR: return '\x1b[31m[ERROR]\x1b[0m'; // Red
      default: return '';
    }
  }
}

// Export a singleton instance
export const logger = new Logger();
