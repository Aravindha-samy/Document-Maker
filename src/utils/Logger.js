const chalk = require('chalk');

/**
 * Simple logger utility with colored output
 */
class Logger {
  constructor(options = {}) {
    this.options = {
      level: options.level || 'info',
      timestamp: options.timestamp !== false,
      colors: options.colors !== false,
      ...options
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      success: 2
    };
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  info(message, ...args) {
    this._log('info', message, ...args);
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  error(message, ...args) {
    this._log('error', message, ...args);
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  warn(message, ...args) {
    this._log('warn', message, ...args);
  }

  /**
   * Log a debug message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  debug(message, ...args) {
    this._log('debug', message, ...args);
  }

  /**
   * Log a success message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  success(message, ...args) {
    this._log('success', message, ...args);
  }

  /**
   * Internal logging method
   * @param {string} level - Log level
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  _log(level, message, ...args) {
    const currentLevel = this.levels[this.options.level] || 2;
    const messageLevel = this.levels[level] || 2;

    if (messageLevel > currentLevel) {
      return;
    }

    let formattedMessage = message;
    
    if (this.options.colors) {
      switch (level) {
        case 'error':
          formattedMessage = chalk.red(`✗ ${message}`);
          break;
        case 'warn':
          formattedMessage = chalk.yellow(`⚠ ${message}`);
          break;
        case 'info':
          formattedMessage = chalk.blue(`ℹ ${message}`);
          break;
        case 'debug':
          formattedMessage = chalk.gray(`🐛 ${message}`);
          break;
        case 'success':
          formattedMessage = chalk.green(`✓ ${message}`);
          break;
        default:
          formattedMessage = message;
      }
    }

    if (this.options.timestamp) {
      const timestamp = new Date().toISOString();
      formattedMessage = `[${timestamp}] ${formattedMessage}`;
    }

    if (level === 'error') {
      console.error(formattedMessage, ...args);
    } else {
      console.log(formattedMessage, ...args);
    }
  }

  /**
   * Create a child logger with additional context
   * @param {object} context - Additional context
   * @returns {Logger} - Child logger
   */
  child(context) {
    return new Logger({
      ...this.options,
      context: { ...this.options.context, ...context }
    });
  }

  /**
   * Set log level
   * @param {string} level - Log level
   */
  setLevel(level) {
    this.options.level = level;
  }
}

module.exports = Logger;
