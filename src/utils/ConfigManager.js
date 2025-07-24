const fs = require('fs-extra');
const path = require('path');
const Logger = require('./Logger');

/**
 * Configuration manager for the documentation maker
 */
class ConfigManager {
  constructor(configPath = './config.json') {
    this.configPath = configPath;
    this.logger = new Logger();
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file or use defaults
   * @returns {object} - Configuration object
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const userConfig = JSON.parse(configData);
        this.logger.info(`Loaded configuration from: ${this.configPath}`);
        return this.mergeWithDefaults(userConfig);
      } else {
        this.logger.info('No configuration file found, using defaults');
        return this.getDefaultConfig();
      }
    } catch (error) {
      this.logger.warn(`Failed to load configuration: ${error.message}, using defaults`);
      return this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration
   * @returns {object} - Default configuration
   */
  getDefaultConfig() {
    return {
      analysis: {
        includePrivate: false,
        includeTests: true,
        includeNodeModules: false,
        maxDepth: 10,
        maxFileSize: 1024 * 1024, // 1MB
        excludePatterns: [
          '*.min.js',
          '*.bundle.js',
          'node_modules/**',
          '.git/**',
          'dist/**',
          'build/**',
          'coverage/**',
          '*.log'
        ],
        supportedLanguages: [
          'javascript',
          'typescript',
          'python',
          'java',
          'csharp',
          'go',
          'rust'
        ]
      },
      output: {
        includeSourceCode: true,
        includeDiagrams: true,
        includeMetrics: true,
        groupByModule: true,
        generateIndex: true,
        maxCodeSnippetLines: 50
      },
      templates: {
        default: 'standard',
        customPath: './templates',
        variables: {
          projectName: 'Project Documentation',
          author: 'Documentation Maker',
          version: '1.0.0'
        }
      },
      formatting: {
        codeHighlighting: true,
        includeLineNumbers: true,
        wrapLongLines: true,
        indentSize: 2
      },
      generation: {
        parallel: true,
        maxConcurrency: 4,
        timeout: 30000, // 30 seconds
        retryAttempts: 3
      }
    };
  }

  /**
   * Merge user configuration with defaults
   * @param {object} userConfig - User configuration
   * @returns {object} - Merged configuration
   */
  mergeWithDefaults(userConfig) {
    const defaultConfig = this.getDefaultConfig();
    return this.deepMerge(defaultConfig, userConfig);
  }

  /**
   * Deep merge two objects
   * @param {object} target - Target object
   * @param {object} source - Source object
   * @returns {object} - Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Get configuration value by path
   * @param {string} path - Configuration path (e.g., 'analysis.includePrivate')
   * @param {any} defaultValue - Default value if path not found
   * @returns {any} - Configuration value
   */
  get(path, defaultValue = null) {
    const keys = path.split('.');
    let current = this.config;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  /**
   * Set configuration value by path
   * @param {string} path - Configuration path
   * @param {any} value - Value to set
   */
  set(path, value) {
    const keys = path.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Save current configuration to file
   */
  async saveConfig() {
    try {
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      this.logger.success(`Configuration saved to: ${this.configPath}`);
    } catch (error) {
      this.logger.error(`Failed to save configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a sample configuration file
   * @param {string} outputPath - Output path for the sample config
   */
  async createSampleConfig(outputPath = './config.sample.json') {
    try {
      const sampleConfig = this.getDefaultConfig();
      await fs.writeFile(
        outputPath,
        JSON.stringify(sampleConfig, null, 2),
        'utf8'
      );
      this.logger.success(`Sample configuration created at: ${outputPath}`);
    } catch (error) {
      this.logger.error(`Failed to create sample configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate configuration
   * @returns {object} - Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Validate analysis settings
    if (this.config.analysis.maxDepth < 1) {
      errors.push('analysis.maxDepth must be at least 1');
    }

    if (this.config.analysis.maxFileSize < 1024) {
      warnings.push('analysis.maxFileSize is very small, may skip important files');
    }

    // Validate generation settings
    if (this.config.generation.maxConcurrency < 1) {
      errors.push('generation.maxConcurrency must be at least 1');
    }

    if (this.config.generation.timeout < 1000) {
      warnings.push('generation.timeout is very low, may cause timeouts');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get the full configuration object
   * @returns {object} - Configuration object
   */
  getAll() {
    return { ...this.config };
  }
}

module.exports = ConfigManager;
