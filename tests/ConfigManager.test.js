const ConfigManager = require('../src/utils/ConfigManager');
const fs = require('fs-extra');
const path = require('path');

describe('ConfigManager', () => {
  let tempDir;
  let configPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-'));
    configPath = path.join(tempDir, 'config.json');
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  describe('constructor', () => {
    test('should load default config when file does not exist', () => {
      const configManager = new ConfigManager(configPath);
      const config = configManager.getAll();
      
      expect(config.analysis).toBeDefined();
      expect(config.output).toBeDefined();
      expect(config.templates).toBeDefined();
    });

    test('should load config from existing file', async () => {
      const testConfig = {
        analysis: {
          includePrivate: true,
          maxDepth: 5
        }
      };
      
      await fs.writeFile(configPath, JSON.stringify(testConfig));
      
      const configManager = new ConfigManager(configPath);
      expect(configManager.get('analysis.includePrivate')).toBe(true);
      expect(configManager.get('analysis.maxDepth')).toBe(5);
    });
  });

  describe('get', () => {
    test('should get nested configuration values', () => {
      const configManager = new ConfigManager(configPath);
      
      const includePrivate = configManager.get('analysis.includePrivate');
      expect(typeof includePrivate).toBe('boolean');
      
      const maxDepth = configManager.get('analysis.maxDepth');
      expect(typeof maxDepth).toBe('number');
    });

    test('should return default value for non-existent path', () => {
      const configManager = new ConfigManager(configPath);
      
      const value = configManager.get('non.existent.path', 'default');
      expect(value).toBe('default');
    });
  });

  describe('set', () => {
    test('should set nested configuration values', () => {
      const configManager = new ConfigManager(configPath);
      
      configManager.set('analysis.includePrivate', true);
      expect(configManager.get('analysis.includePrivate')).toBe(true);
      
      configManager.set('new.nested.value', 'test');
      expect(configManager.get('new.nested.value')).toBe('test');
    });
  });

  describe('validate', () => {
    test('should validate correct configuration', () => {
      const configManager = new ConfigManager(configPath);
      const validation = configManager.validate();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid maxDepth', () => {
      const configManager = new ConfigManager(configPath);
      configManager.set('analysis.maxDepth', 0);
      
      const validation = configManager.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('analysis.maxDepth must be at least 1');
    });

    test('should detect invalid maxConcurrency', () => {
      const configManager = new ConfigManager(configPath);
      configManager.set('generation.maxConcurrency', 0);
      
      const validation = configManager.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('generation.maxConcurrency must be at least 1');
    });

    test('should generate warnings for suspicious values', () => {
      const configManager = new ConfigManager(configPath);
      configManager.set('analysis.maxFileSize', 500); // Very small
      configManager.set('generation.timeout', 500); // Very low
      
      const validation = configManager.validate();
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('saveConfig', () => {
    test('should save configuration to file', async () => {
      const configManager = new ConfigManager(configPath);
      configManager.set('test.value', 'saved');
      
      await configManager.saveConfig();
      
      expect(await fs.pathExists(configPath)).toBe(true);
      
      const savedConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
      expect(savedConfig.test.value).toBe('saved');
    });
  });

  describe('createSampleConfig', () => {
    test('should create sample configuration file', async () => {
      const configManager = new ConfigManager(configPath);
      const samplePath = path.join(tempDir, 'sample.json');
      
      await configManager.createSampleConfig(samplePath);
      
      expect(await fs.pathExists(samplePath)).toBe(true);
      
      const sampleConfig = JSON.parse(await fs.readFile(samplePath, 'utf8'));
      expect(sampleConfig.analysis).toBeDefined();
      expect(sampleConfig.output).toBeDefined();
    });
  });

  describe('mergeWithDefaults', () => {
    test('should merge user config with defaults', () => {
      const configManager = new ConfigManager(configPath);
      const userConfig = {
        analysis: {
          includePrivate: true
        },
        newSection: {
          value: 'test'
        }
      };
      
      const merged = configManager.mergeWithDefaults(userConfig);
      
      expect(merged.analysis.includePrivate).toBe(true); // User value
      expect(merged.analysis.maxDepth).toBeDefined(); // Default value
      expect(merged.newSection.value).toBe('test'); // User value
    });
  });
});
