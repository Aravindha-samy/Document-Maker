#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const DocumentationMaker = require('./DocumentationMaker');
const Logger = require('./utils/Logger');

const program = new Command();
const logger = new Logger();

// Package information
const packageJson = require('../package.json');

program
  .name('doc-maker')
  .description('Generate documentation from GitHub and Azure DevOps repositories')
  .version(packageJson.version);

// Main generate command
program
  .command('generate')
  .alias('gen')
  .description('Generate documentation from a repository')
  .option('-u, --url <url>', 'Repository URL (GitHub or Azure DevOps)')
  .option('-b, --branch <branch>', 'Branch name', 'main')
  .option('-o, --output <path>', 'Output directory', './docs')
  .option('-f, --format <format>', 'Output format (markdown, html, pdf)', 'markdown')
  .option('-c, --config <path>', 'Configuration file path', './config.json')
  .option('-t, --template <name>', 'Template name', 'standard')
  .option('--interactive', 'Run in interactive mode')
  .option('--verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      // Set log level
      if (options.verbose) {
        logger.setLevel('debug');
      }

      // Run in interactive mode if requested or if no URL provided
      if (options.interactive || !options.url) {
        options = await runInteractiveMode(options);
      }

      // Validate required options
      if (!options.url) {
        logger.error('Repository URL is required. Use --url or --interactive flag.');
        process.exit(1);
      }

      // Show configuration
      displayConfiguration(options);

      // Create documentation maker instance
      const docMaker = new DocumentationMaker({
        repositoryUrl: options.url,
        branch: options.branch,
        outputPath: options.output,
        format: options.format,
        configPath: options.config,
        templateName: options.template
      });

      // Generate documentation with progress indicator
      const spinner = ora('Generating documentation...').start();
      
      try {
        const result = await docMaker.generate();
        spinner.succeed('Documentation generated successfully!');
        
        // Display results
        displayResults(result);
        
      } catch (error) {
        spinner.fail('Documentation generation failed');
        throw error;
      }

    } catch (error) {
      logger.error('Command failed:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Initialize command
program
  .command('init')
  .description('Initialize a new documentation project')
  .option('-o, --output <path>', 'Output directory', '.')
  .action(async (options) => {
    try {
      await initializeProject(options.output);
    } catch (error) {
      logger.error('Initialization failed:', error.message);
      process.exit(1);
    }
  });

// List templates command
program
  .command('templates')
  .alias('list-templates')
  .description('List available documentation templates')
  .action(async () => {
    try {
      await listTemplates();
    } catch (error) {
      logger.error('Failed to list templates:', error.message);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate configuration file')
  .option('-c, --config <path>', 'Configuration file path', './config.json')
  .action(async (options) => {
    try {
      await validateConfiguration(options.config);
    } catch (error) {
      logger.error('Validation failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Run interactive mode to collect options
 */
async function runInteractiveMode(existingOptions = {}) {
  console.log(chalk.blue('\n🚀 Welcome to Documentation Maker Interactive Mode\n'));

  const questions = [
    {
      type: 'input',
      name: 'url',
      message: 'Repository URL (GitHub or Azure DevOps):',
      default: existingOptions.url,
      validate: (input) => {
        if (!input) return 'Repository URL is required';
        const urlPattern = /^https?:\/\/(github\.com|dev\.azure\.com)/;
        if (!urlPattern.test(input)) {
          return 'Please enter a valid GitHub or Azure DevOps URL';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'branch',
      message: 'Branch name:',
      default: existingOptions.branch || 'main'
    },
    {
      type: 'input',
      name: 'output',
      message: 'Output directory:',
      default: existingOptions.output || './docs'
    },
    {
      type: 'list',
      name: 'format',
      message: 'Output format:',
      choices: ['markdown', 'html', 'pdf'],
      default: existingOptions.format || 'markdown'
    },
    {
      type: 'input',
      name: 'template',
      message: 'Template name:',
      default: existingOptions.template || 'standard'
    },
    {
      type: 'confirm',
      name: 'verbose',
      message: 'Enable verbose logging?',
      default: existingOptions.verbose || false
    }
  ];

  const answers = await inquirer.prompt(questions);
  return { ...existingOptions, ...answers };
}

/**
 * Display current configuration
 */
function displayConfiguration(options) {
  console.log(chalk.cyan('\n📋 Configuration:'));
  console.log(`  Repository: ${chalk.white(options.url)}`);
  console.log(`  Branch: ${chalk.white(options.branch)}`);
  console.log(`  Output: ${chalk.white(options.output)}`);
  console.log(`  Format: ${chalk.white(options.format)}`);
  console.log(`  Template: ${chalk.white(options.template)}`);
  console.log('');
}

/**
 * Display generation results
 */
function displayResults(result) {
  console.log(chalk.green('\n✅ Documentation Generation Complete!\n'));
  
  console.log(chalk.cyan('📊 Statistics:'));
  console.log(`  Files analyzed: ${chalk.white(result.analysisResult.files.length)}`);
  console.log(`  Classes found: ${chalk.white(result.analysisResult.classes.length)}`);
  console.log(`  Functions found: ${chalk.white(result.analysisResult.functions.length)}`);
  console.log(`  Dependencies: ${chalk.white(result.analysisResult.dependencies.length)}`);
  
  console.log(chalk.cyan('\n📁 Output:'));
  console.log(`  Location: ${chalk.white(result.outputPath)}`);
  
  const languages = Object.keys(result.analysisResult.metrics.languageDistribution || {});
  if (languages.length > 0) {
    console.log(chalk.cyan('\n🔤 Languages detected:'));
    languages.forEach(lang => {
      const count = result.analysisResult.metrics.languageDistribution[lang];
      console.log(`  ${chalk.white(lang)}: ${count} files`);
    });
  }
  
  console.log(chalk.yellow('\n💡 Next steps:'));
  console.log(`  • Open ${chalk.white(result.outputPath)} to view the documentation`);
  console.log(`  • Customize templates in ${chalk.white('./templates')} directory`);
  console.log(`  • Modify ${chalk.white('./config.json')} for advanced settings`);
  console.log('');
}

/**
 * Initialize a new documentation project
 */
async function initializeProject(outputPath) {
  const spinner = ora('Initializing documentation project...').start();
  
  try {
    // Create directories
    await fs.ensureDir(outputPath);
    await fs.ensureDir(path.join(outputPath, 'templates'));
    await fs.ensureDir(path.join(outputPath, 'docs'));
    
    // Create sample configuration
    const ConfigManager = require('./utils/ConfigManager');
    const configManager = new ConfigManager();
    await configManager.createSampleConfig(path.join(outputPath, 'config.json'));
    
    // Create sample template
    const sampleTemplate = `# {{projectName}} Documentation

Generated on {{formatDate generatedAt}}

## Overview
{{#each files}}
- {{relativePath}}
{{/each}}

## Classes
{{#each classes}}
### {{name}}
File: {{file}}
{{/each}}`;
    
    await fs.ensureDir(path.join(outputPath, 'templates', 'custom'));
    await fs.writeFile(
      path.join(outputPath, 'templates', 'custom', 'markdown.hbs'),
      sampleTemplate
    );
    
    // Create README
    const readme = `# Documentation Maker Project

This project was initialized with Documentation Maker.

## Usage

\`\`\`bash
# Generate documentation
doc-maker generate --url <repository-url>

# Interactive mode
doc-maker generate --interactive
\`\`\`

## Configuration

Edit \`config.json\` to customize the documentation generation.

## Templates

Custom templates can be added to the \`templates/\` directory.
`;
    
    await fs.writeFile(path.join(outputPath, 'README.md'), readme);
    
    spinner.succeed('Project initialized successfully!');
    
    console.log(chalk.green('\n✅ Project initialized!\n'));
    console.log(chalk.cyan('📁 Created:'));
    console.log(`  ${chalk.white('config.json')} - Configuration file`);
    console.log(`  ${chalk.white('templates/')} - Custom templates directory`);
    console.log(`  ${chalk.white('docs/')} - Output directory`);
    console.log(`  ${chalk.white('README.md')} - Project documentation`);
    
  } catch (error) {
    spinner.fail('Project initialization failed');
    throw error;
  }
}

/**
 * List available templates
 */
async function listTemplates() {
  const DocumentationGenerator = require('./generators/DocumentationGenerator');
  const generator = new DocumentationGenerator({});
  
  try {
    const templates = await generator.getAvailableTemplates();
    
    console.log(chalk.cyan('\n📋 Available Templates:\n'));
    templates.forEach(template => {
      console.log(`  • ${chalk.white(template)}`);
    });
    console.log('');
    
  } catch (error) {
    logger.warn('Could not load templates list');
    console.log(chalk.cyan('\n📋 Default Templates:\n'));
    console.log(`  • ${chalk.white('standard')}`);
    console.log('');
  }
}

/**
 * Validate configuration file
 */
async function validateConfiguration(configPath) {
  const ConfigManager = require('./utils/ConfigManager');
  
  try {
    const configManager = new ConfigManager(configPath);
    const validation = configManager.validate();
    
    if (validation.valid) {
      console.log(chalk.green('\n✅ Configuration is valid!\n'));
    } else {
      console.log(chalk.red('\n❌ Configuration validation failed:\n'));
      validation.errors.forEach(error => {
        console.log(chalk.red(`  • ${error}`));
      });
    }
    
    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:\n'));
      validation.warnings.forEach(warning => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }
    
    console.log('');
    
  } catch (error) {
    throw new Error(`Failed to validate configuration: ${error.message}`);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
