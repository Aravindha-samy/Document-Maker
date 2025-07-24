const fs = require('fs-extra');
const path = require('path');
const Handlebars = require('handlebars');
const marked = require('marked');
const puppeteer = require('puppeteer');
const Logger = require('../utils/Logger');

/**
 * Core documentation generation engine
 */
class DocumentationGenerator {
  constructor(config) {
    this.config = config;
    this.logger = new Logger();
    this.templates = {};
    this.initializeHandlebars();
  }

  /**
   * Initialize Handlebars with custom helpers
   */
  initializeHandlebars() {
    // Register custom helpers
    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('ne', (a, b) => a !== b);
    Handlebars.registerHelper('gt', (a, b) => a > b);
    Handlebars.registerHelper('lt', (a, b) => a < b);
    Handlebars.registerHelper('and', (a, b) => a && b);
    Handlebars.registerHelper('or', (a, b) => a || b);
    Handlebars.registerHelper('capitalize', str => str.charAt(0).toUpperCase() + str.slice(1));
    Handlebars.registerHelper('lowercase', str => str.toLowerCase());
    Handlebars.registerHelper('uppercase', str => str.toUpperCase());
    Handlebars.registerHelper('json', obj => JSON.stringify(obj, null, 2));
    
    // Helper for formatting code
    Handlebars.registerHelper('formatCode', (code, language) => {
      return `\`\`\`${language}\n${code}\n\`\`\``;
    });

    // Helper for creating links
    Handlebars.registerHelper('link', (text, url) => {
      return `[${text}](${url})`;
    });

    // Helper for date formatting
    Handlebars.registerHelper('formatDate', date => {
      return new Date(date).toLocaleDateString();
    });
  }

  /**
   * Generate documentation from analysis results
   * @param {object} analysisResult - Code analysis results
   * @param {string} format - Output format (markdown, html, pdf)
   * @param {string} templateName - Template name
   * @returns {object} - Generated documentation
   */
  async generate(analysisResult, format = 'markdown', templateName = 'standard') {
    try {
      this.logger.info(`Generating ${format} documentation using ${templateName} template...`);

      // Load template
      const template = await this.loadTemplate(templateName, format);

      // Prepare template data
      const templateData = this.prepareTemplateData(analysisResult);

      // Generate content
      const content = await this.generateContent(template, templateData, format);

      // Prepare assets if needed
      const assets = await this.prepareAssets(format);

      const result = {
        content,
        assets,
        metadata: {
          format,
          templateName,
          generatedAt: new Date().toISOString(),
          analysisResult: {
            totalFiles: analysisResult.files.length,
            totalClasses: analysisResult.classes.length,
            totalFunctions: analysisResult.functions.length,
            languages: Object.keys(analysisResult.metrics.languageDistribution || {})
          }
        }
      };

      this.logger.success(`Documentation generated successfully in ${format} format`);
      return result;

    } catch (error) {
      this.logger.error('Documentation generation failed:', error);
      throw error;
    }
  }

  /**
   * Load template based on name and format
   * @param {string} templateName - Template name
   * @param {string} format - Output format
   * @returns {string} - Template content
   */
  async loadTemplate(templateName, format) {
    const templatePath = path.join(__dirname, '../templates', templateName, `${format}.hbs`);
    
    try {
      if (await fs.pathExists(templatePath)) {
        return await fs.readFile(templatePath, 'utf8');
      } else {
        // Use default template
        return this.getDefaultTemplate(format);
      }
    } catch (error) {
      this.logger.warn(`Failed to load template ${templateName}, using default`);
      return this.getDefaultTemplate(format);
    }
  }

  /**
   * Get default template for format
   * @param {string} format - Output format
   * @returns {string} - Default template
   */
  getDefaultTemplate(format) {
    switch (format) {
      case 'markdown':
        return this.getDefaultMarkdownTemplate();
      case 'html':
        return this.getDefaultHtmlTemplate();
      default:
        return this.getDefaultMarkdownTemplate();
    }
  }

  /**
   * Get default Markdown template
   * @returns {string} - Markdown template
   */
  getDefaultMarkdownTemplate() {
    return `# {{projectName}} Documentation

Generated on {{formatDate generatedAt}}

## Overview

This documentation was automatically generated from the codebase analysis.

### Project Statistics

- **Total Files**: {{metrics.totalFiles}}
- **Total Classes**: {{metrics.totalClasses}}
- **Total Functions**: {{metrics.totalFunctions}}
- **Total Interfaces**: {{metrics.totalInterfaces}}

### Language Distribution

{{#each metrics.languageDistribution}}
- **{{@key}}**: {{this}} files
{{/each}}

## Project Structure

{{#each structure.modules}}
### {{path}}

{{#if files.length}}
#### Files
{{#each files}}
- \`{{relativePath}}\` ({{language}})
{{/each}}
{{/if}}

{{#if classes.length}}
#### Classes
{{#each classes}}
- **{{name}}** (Lines {{startLine}}-{{endLine}})
{{/each}}
{{/if}}

{{#if functions.length}}
#### Functions
{{#each functions}}
- **{{name}}** (Lines {{startLine}}-{{endLine}})
{{/each}}
{{/if}}

{{/each}}

## Classes

{{#each classes}}
### {{name}}

**File**: \`{{file}}\`  
**Language**: {{language}}  
**Lines**: {{startLine}}-{{endLine}}

{{#if methods.length}}
#### Methods
{{#each methods}}
- **{{name}}**
{{/each}}
{{/if}}

{{#if properties.length}}
#### Properties
{{#each properties}}
- **{{name}}**
{{/each}}
{{/if}}

---

{{/each}}

## Functions

{{#each functions}}
### {{name}}

**File**: \`{{file}}\`  
**Language**: {{language}}  
**Lines**: {{startLine}}-{{endLine}}

{{#if parameters.length}}
#### Parameters
{{#each parameters}}
- **{{name}}**: {{type}}
{{/each}}
{{/if}}

{{#if returnType}}
#### Returns
{{returnType}}
{{/if}}

---

{{/each}}

## Dependencies

{{#each dependencies}}
- \`{{from}}\` → \`{{to}}\`
{{/each}}

## Metrics

### Complexity Metrics
- **Average Functions per File**: {{metrics.complexityMetrics.averageFunctionsPerFile}}
- **Average Classes per File**: {{metrics.complexityMetrics.averageClassesPerFile}}
- **Total Dependencies**: {{metrics.complexityMetrics.totalDependencies}}

---

*Documentation generated by Documentation Maker*`;
  }

  /**
   * Get default HTML template
   * @returns {string} - HTML template
   */
  getDefaultHtmlTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}} Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            border-bottom: 2px solid #eee;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
        .section {
            margin: 30px 0;
        }
        .code-block {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            font-family: 'Monaco', 'Consolas', monospace;
            overflow-x: auto;
        }
        .item {
            background: white;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
            margin: 10px 0;
        }
        .item-header {
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
        }
        .meta {
            color: #666;
            font-size: 0.9em;
        }
        nav {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        nav ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        nav li {
            display: inline-block;
            margin-right: 20px;
        }
        nav a {
            text-decoration: none;
            color: #007bff;
        }
        nav a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{projectName}} Documentation</h1>
        <p class="meta">Generated on {{formatDate generatedAt}}</p>
    </div>

    <nav>
        <ul>
            <li><a href="#overview">Overview</a></li>
            <li><a href="#structure">Structure</a></li>
            <li><a href="#classes">Classes</a></li>
            <li><a href="#functions">Functions</a></li>
            <li><a href="#dependencies">Dependencies</a></li>
        </ul>
    </nav>

    <section id="overview" class="section">
        <h2>Overview</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>{{metrics.totalFiles}}</h3>
                <p>Total Files</p>
            </div>
            <div class="stat-card">
                <h3>{{metrics.totalClasses}}</h3>
                <p>Total Classes</p>
            </div>
            <div class="stat-card">
                <h3>{{metrics.totalFunctions}}</h3>
                <p>Total Functions</p>
            </div>
            <div class="stat-card">
                <h3>{{metrics.totalInterfaces}}</h3>
                <p>Total Interfaces</p>
            </div>
        </div>

        <h3>Language Distribution</h3>
        <ul>
        {{#each metrics.languageDistribution}}
            <li><strong>{{@key}}</strong>: {{this}} files</li>
        {{/each}}
        </ul>
    </section>

    <section id="structure" class="section">
        <h2>Project Structure</h2>
        {{#each structure.modules}}
        <div class="item">
            <div class="item-header">{{path}}</div>
            {{#if files.length}}
            <h4>Files</h4>
            <ul>
            {{#each files}}
                <li><code>{{relativePath}}</code> ({{language}})</li>
            {{/each}}
            </ul>
            {{/if}}
        </div>
        {{/each}}
    </section>

    <section id="classes" class="section">
        <h2>Classes</h2>
        {{#each classes}}
        <div class="item">
            <div class="item-header">{{name}}</div>
            <div class="meta">
                <strong>File:</strong> <code>{{file}}</code><br>
                <strong>Language:</strong> {{language}}<br>
                <strong>Lines:</strong> {{startLine}}-{{endLine}}
            </div>
        </div>
        {{/each}}
    </section>

    <section id="functions" class="section">
        <h2>Functions</h2>
        {{#each functions}}
        <div class="item">
            <div class="item-header">{{name}}</div>
            <div class="meta">
                <strong>File:</strong> <code>{{file}}</code><br>
                <strong>Language:</strong> {{language}}<br>
                <strong>Lines:</strong> {{startLine}}-{{endLine}}
            </div>
        </div>
        {{/each}}
    </section>

    <section id="dependencies" class="section">
        <h2>Dependencies</h2>
        <ul>
        {{#each dependencies}}
            <li><code>{{from}}</code> → <code>{{to}}</code></li>
        {{/each}}
        </ul>
    </section>

    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
        <p>Documentation generated by Documentation Maker</p>
    </footer>
</body>
</html>`;
  }

  /**
   * Prepare template data from analysis results
   * @param {object} analysisResult - Analysis results
   * @returns {object} - Template data
   */
  prepareTemplateData(analysisResult) {
    const templateVars = this.config.get('templates.variables', {});
    
    return {
      projectName: templateVars.projectName || 'Project Documentation',
      author: templateVars.author || 'Documentation Maker',
      version: templateVars.version || '1.0.0',
      generatedAt: new Date().toISOString(),
      ...analysisResult
    };
  }

  /**
   * Generate content using template and data
   * @param {string} template - Template content
   * @param {object} data - Template data
   * @param {string} format - Output format
   * @returns {string} - Generated content
   */
  async generateContent(template, data, format) {
    try {
      const compiledTemplate = Handlebars.compile(template);
      let content = compiledTemplate(data);

      // Post-process based on format
      if (format === 'pdf') {
        // Convert markdown to HTML first, then to PDF
        if (template.includes('{{') && template.includes('}}')) {
          // If it's a Handlebars template, assume it generates markdown
          content = marked.parse(content);
        }
        content = await this.convertToPdf(content);
      }

      return content;

    } catch (error) {
      this.logger.error('Content generation failed:', error);
      throw error;
    }
  }

  /**
   * Convert HTML content to PDF
   * @param {string} htmlContent - HTML content
   * @returns {Buffer} - PDF buffer
   */
  async convertToPdf(htmlContent) {
    let browser;
    try {
      browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });

      return pdfBuffer;

    } catch (error) {
      this.logger.error('PDF conversion failed:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Prepare assets for the documentation
   * @param {string} format - Output format
   * @returns {object} - Assets object
   */
  async prepareAssets(format) {
    const assets = {};

    if (format === 'html') {
      // Add CSS file if needed
      assets['styles.css'] = this.getDefaultCSS();
    }

    return assets;
  }

  /**
   * Get default CSS for HTML output
   * @returns {string} - CSS content
   */
  getDefaultCSS() {
    return `/* Additional styles can be added here */`;
  }

  /**
   * Get available templates
   * @returns {Array} - List of available templates
   */
  async getAvailableTemplates() {
    const templatesDir = path.join(__dirname, '../templates');
    
    try {
      if (await fs.pathExists(templatesDir)) {
        const items = await fs.readdir(templatesDir);
        return items.filter(async item => {
          const itemPath = path.join(templatesDir, item);
          const stat = await fs.stat(itemPath);
          return stat.isDirectory();
        });
      }
    } catch (error) {
      this.logger.warn('Failed to read templates directory');
    }

    return ['standard'];
  }
}

module.exports = DocumentationGenerator;
