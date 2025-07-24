const DocumentationMaker = require('../src/DocumentationMaker');
const fs = require('fs-extra');
const path = require('path');

describe('DocumentationMaker', () => {
  let tempDir;
  let docMaker;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-'));
    docMaker = new DocumentationMaker({
      repositoryUrl: 'https://github.com/test/repo',
      branch: 'main',
      outputPath: tempDir,
      format: 'markdown'
    });
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  describe('constructor', () => {
    test('should create instance with default options', () => {
      const maker = new DocumentationMaker();
      expect(maker.options.branch).toBe('main');
      expect(maker.options.format).toBe('markdown');
      expect(maker.options.outputPath).toBe('./docs');
    });

    test('should merge custom options with defaults', () => {
      const maker = new DocumentationMaker({
        branch: 'develop',
        format: 'html'
      });
      expect(maker.options.branch).toBe('develop');
      expect(maker.options.format).toBe('html');
      expect(maker.options.outputPath).toBe('./docs'); // default
    });
  });

  describe('validateInputs', () => {
    test('should throw error for missing repository URL', async () => {
      const maker = new DocumentationMaker({ repositoryUrl: '' });
      await expect(maker.validateInputs()).rejects.toThrow('Repository URL is required');
    });

    test('should throw error for invalid repository URL', async () => {
      const maker = new DocumentationMaker({ repositoryUrl: 'https://invalid.com/repo' });
      await expect(maker.validateInputs()).rejects.toThrow('Invalid repository URL');
    });

    test('should throw error for unsupported format', async () => {
      const maker = new DocumentationMaker({
        repositoryUrl: 'https://github.com/test/repo',
        format: 'invalid'
      });
      await expect(maker.validateInputs()).rejects.toThrow('Unsupported format');
    });

    test('should pass validation for valid inputs', async () => {
      await expect(docMaker.validateInputs()).resolves.not.toThrow();
    });
  });

  describe('static methods', () => {
    test('getSupportedPlatforms should return correct platforms', () => {
      const platforms = DocumentationMaker.getSupportedPlatforms();
      expect(platforms).toContain('github');
      expect(platforms).toContain('azure-devops');
    });

    test('getSupportedFormats should return correct formats', () => {
      const formats = DocumentationMaker.getSupportedFormats();
      expect(formats).toContain('markdown');
      expect(formats).toContain('html');
      expect(formats).toContain('pdf');
    });

    test('getSupportedLanguages should return correct languages', () => {
      const languages = DocumentationMaker.getSupportedLanguages();
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('java');
    });
  });

  describe('saveDocumentation', () => {
    test('should save markdown documentation', async () => {
      const documentation = {
        content: '# Test Documentation',
        metadata: { test: true }
      };

      await docMaker.saveDocumentation(documentation);

      const readmePath = path.join(tempDir, 'README.md');
      const metadataPath = path.join(tempDir, 'analysis-metadata.json');

      expect(await fs.pathExists(readmePath)).toBe(true);
      expect(await fs.pathExists(metadataPath)).toBe(true);

      const content = await fs.readFile(readmePath, 'utf8');
      expect(content).toBe('# Test Documentation');
    });

    test('should save HTML documentation with assets', async () => {
      const htmlMaker = new DocumentationMaker({
        repositoryUrl: 'https://github.com/test/repo',
        outputPath: tempDir,
        format: 'html'
      });

      const documentation = {
        content: '<html><body>Test</body></html>',
        assets: {
          'styles.css': 'body { margin: 0; }'
        },
        metadata: { test: true }
      };

      await htmlMaker.saveDocumentation(documentation);

      const htmlPath = path.join(tempDir, 'index.html');
      const cssPath = path.join(tempDir, 'styles.css');

      expect(await fs.pathExists(htmlPath)).toBe(true);
      expect(await fs.pathExists(cssPath)).toBe(true);

      const cssContent = await fs.readFile(cssPath, 'utf8');
      expect(cssContent).toBe('body { margin: 0; }');
    });
  });
});
