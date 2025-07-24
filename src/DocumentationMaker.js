const fs = require('fs-extra');
const path = require('path');
const RepositoryManager = require('./integrations/RepositoryManager');
const CodeAnalyzer = require('./analyzers/CodeAnalyzer');
const DocumentationGenerator = require('./generators/DocumentationGenerator');
const ConfigManager = require('./utils/ConfigManager');
const Logger = require('./utils/Logger');

/**
 * Main class for generating documentation from repositories
 */
class DocumentationMaker {
  constructor(options = {}) {
    this.options = {
      repositoryUrl: options.repositoryUrl || '',
      branch: options.branch || 'main',
      outputPath: options.outputPath || './docs',
      format: options.format || 'markdown',
      configPath: options.configPath || './config.json',
      templateName: options.templateName || 'standard',
      ...options
    };

    this.config = new ConfigManager(this.options.configPath);
    this.logger = new Logger();
    this.repositoryManager = new RepositoryManager();
    this.codeAnalyzer = new CodeAnalyzer(this.config);
    this.documentationGenerator = new DocumentationGenerator(this.config);
  }

  /**
   * Generate documentation for the specified repository
   */
  async generate() {
    try {
      this.logger.info('Starting documentation generation...');
      
      // Validate inputs
      await this.validateInputs();
      
      // Clone or access repository
      this.logger.info('Accessing repository...');
      const repoPath = await this.repositoryManager.cloneRepository(
        this.options.repositoryUrl,
        this.options.branch
      );
      
      // Analyze code
      this.logger.info('Analyzing code structure...');
      const analysisResult = await this.codeAnalyzer.analyze(repoPath);
      
      // Generate documentation
      this.logger.info('Generating documentation...');
      const documentation = await this.documentationGenerator.generate(
        analysisResult,
        this.options.format,
        this.options.templateName
      );
      
      // Save documentation
      this.logger.info('Saving documentation...');
      await this.saveDocumentation(documentation);
      
      // Cleanup temporary files
      await this.repositoryManager.cleanup();
      
      this.logger.success(`Documentation generated successfully at: ${this.options.outputPath}`);
      
      return {
        success: true,
        outputPath: this.options.outputPath,
        analysisResult,
        documentation
      };
      
    } catch (error) {
      this.logger.error('Documentation generation failed:', error);
      await this.repositoryManager.cleanup();
      throw error;
    }
  }

  /**
   * Validate input parameters
   */
  async validateInputs() {
    if (!this.options.repositoryUrl) {
      throw new Error('Repository URL is required');
    }

    // Validate URL format
    const urlPattern = /^https?:\/\/(github\.com|dev\.azure\.com)/;
    if (!urlPattern.test(this.options.repositoryUrl)) {
      throw new Error('Invalid repository URL. Only GitHub and Azure DevOps URLs are supported');
    }

    // Validate output format
    const supportedFormats = ['markdown', 'html', 'pdf'];
    if (!supportedFormats.includes(this.options.format)) {
      throw new Error(`Unsupported format: ${this.options.format}. Supported formats: ${supportedFormats.join(', ')}`);
    }

    // Ensure output directory exists
    await fs.ensureDir(this.options.outputPath);
  }

  /**
   * Save generated documentation to files
   */
  async saveDocumentation(documentation) {
    const outputPath = this.options.outputPath;
    
    switch (this.options.format) {
      case 'markdown':
        await fs.writeFile(
          path.join(outputPath, 'README.md'),
          documentation.content
        );
        break;
        
      case 'html':
        await fs.writeFile(
          path.join(outputPath, 'index.html'),
          documentation.content
        );
        // Copy CSS and assets if any
        if (documentation.assets) {
          for (const [filename, content] of Object.entries(documentation.assets)) {
            await fs.writeFile(path.join(outputPath, filename), content);
          }
        }
        break;
        
      case 'pdf':
        await fs.writeFile(
          path.join(outputPath, 'documentation.pdf'),
          documentation.content
        );
        break;
        
      default:
        throw new Error(`Unsupported output format: ${this.options.format}`);
    }

    // Save analysis metadata
    await fs.writeFile(
      path.join(outputPath, 'analysis-metadata.json'),
      JSON.stringify(documentation.metadata, null, 2)
    );
  }

  /**
   * Get supported repository platforms
   */
  static getSupportedPlatforms() {
    return ['github', 'azure-devops'];
  }

  /**
   * Get supported output formats
   */
  static getSupportedFormats() {
    return ['markdown', 'html', 'pdf'];
  }

  /**
   * Get supported programming languages
   */
  static getSupportedLanguages() {
    return ['javascript', 'typescript', 'python', 'java', 'csharp', 'go', 'rust'];
  }
}

module.exports = DocumentationMaker;
