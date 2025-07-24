const fs = require('fs-extra');
const path = require('path');
const Logger = require('../utils/Logger');

// Try to load tree-sitter and language parsers
let Parser, JavaScript, TypeScript, Python, Java, CSharp, Go, Rust;
let treeSitterAvailable = false;

try {
  Parser = require('tree-sitter');
  JavaScript = require('tree-sitter-javascript');
  TypeScript = require('tree-sitter-typescript').typescript;
  Python = require('tree-sitter-python');
  Java = require('tree-sitter-java');
  CSharp = require('tree-sitter-c-sharp');
  Go = require('tree-sitter-go');
  Rust = require('tree-sitter-rust');
  treeSitterAvailable = true;
} catch (error) {
  // Tree-sitter dependencies not available, will use basic analysis
}

/**
 * Main code analysis engine that understands multiple programming languages
 */
class CodeAnalyzer {
  constructor(config) {
    this.config = config;
    this.logger = new Logger();
    this.parser = treeSitterAvailable ? new Parser() : null;
    this.languageMap = this.initializeLanguageMap();
    this.analysisResult = {
      files: [],
      modules: [],
      classes: [],
      functions: [],
      interfaces: [],
      dependencies: [],
      metrics: {},
      structure: {}
    };

    if (!treeSitterAvailable) {
      this.logger.warn('Tree-sitter not available. Using basic file analysis only.');
      this.logger.info('To enable advanced code parsing, install tree-sitter dependencies:');
      this.logger.info('npm install tree-sitter tree-sitter-javascript tree-sitter-python tree-sitter-java tree-sitter-c-sharp tree-sitter-go tree-sitter-rust tree-sitter-typescript');
    }
  }

  /**
   * Initialize language parser map
   */
  initializeLanguageMap() {
    if (!treeSitterAvailable) {
      return {
        '.js': { parser: null, language: 'javascript' },
        '.jsx': { parser: null, language: 'javascript' },
        '.ts': { parser: null, language: 'typescript' },
        '.tsx': { parser: null, language: 'typescript' },
        '.py': { parser: null, language: 'python' },
        '.java': { parser: null, language: 'java' },
        '.cs': { parser: null, language: 'csharp' },
        '.go': { parser: null, language: 'go' },
        '.rs': { parser: null, language: 'rust' }
      };
    }

    return {
      '.js': { parser: JavaScript, language: 'javascript' },
      '.jsx': { parser: JavaScript, language: 'javascript' },
      '.ts': { parser: TypeScript, language: 'typescript' },
      '.tsx': { parser: TypeScript, language: 'typescript' },
      '.py': { parser: Python, language: 'python' },
      '.java': { parser: Java, language: 'java' },
      '.cs': { parser: CSharp, language: 'csharp' },
      '.go': { parser: Go, language: 'go' },
      '.rs': { parser: Rust, language: 'rust' }
    };
  }

  /**
   * Analyze repository code structure
   * @param {string} repositoryPath - Path to repository
   * @returns {object} - Analysis result
   */
  async analyze(repositoryPath) {
    try {
      this.logger.info('Starting code analysis...');
      
      // Reset analysis result
      this.analysisResult = {
        files: [],
        modules: [],
        classes: [],
        functions: [],
        interfaces: [],
        dependencies: [],
        metrics: {},
        structure: {}
      };

      // Scan repository structure
      await this.scanRepository(repositoryPath);
      
      // Analyze each file
      await this.analyzeFiles();
      
      // Calculate metrics
      this.calculateMetrics();
      
      // Build dependency graph
      this.buildDependencyGraph();
      
      this.logger.success(`Analysis completed. Found ${this.analysisResult.files.length} files`);
      return this.analysisResult;
      
    } catch (error) {
      this.logger.error('Code analysis failed:', error);
      throw error;
    }
  }

  /**
   * Scan repository structure and collect files
   * @param {string} repositoryPath - Path to repository
   */
  async scanRepository(repositoryPath) {
    const excludePatterns = this.config.get('analysis.excludePatterns', []);
    const maxFileSize = this.config.get('analysis.maxFileSize', 1024 * 1024);
    
    const scanDir = async (dirPath, relativePath = '') => {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const relativeItemPath = path.join(relativePath, item);
        
        // Check if item should be excluded
        if (this.shouldExclude(relativeItemPath, excludePatterns)) {
          continue;
        }
        
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          await scanDir(itemPath, relativeItemPath);
        } else if (stat.isFile() && stat.size <= maxFileSize) {
          const ext = path.extname(item).toLowerCase();
          
          if (this.languageMap[ext]) {
            this.analysisResult.files.push({
              path: itemPath,
              relativePath: relativeItemPath,
              extension: ext,
              language: this.languageMap[ext].language,
              size: stat.size,
              lastModified: stat.mtime
            });
          }
        }
      }
    };
    
    await scanDir(repositoryPath);
  }

  /**
   * Check if file/directory should be excluded
   * @param {string} relativePath - Relative path
   * @param {Array} excludePatterns - Exclude patterns
   * @returns {boolean} - True if should be excluded
   */
  shouldExclude(relativePath, excludePatterns) {
    return excludePatterns.some(pattern => {
      // Simple glob pattern matching
      const regex = new RegExp(
        pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '[^/]')
      );
      return regex.test(relativePath);
    });
  }

  /**
   * Analyze all collected files
   */
  async analyzeFiles() {
    const maxConcurrency = this.config.get('generation.maxConcurrency', 4);
    const chunks = this.chunkArray(this.analysisResult.files, maxConcurrency);
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map(file => this.analyzeFile(file)));
    }
  }

  /**
   * Analyze a single file
   * @param {object} file - File information
   */
  async analyzeFile(file) {
    try {
      const content = await fs.readFile(file.path, 'utf8');
      const languageInfo = this.languageMap[file.extension];

      let analysis;

      if (treeSitterAvailable && this.parser && languageInfo.parser) {
        // Use tree-sitter for advanced parsing
        this.parser.setLanguage(languageInfo.parser);
        const tree = this.parser.parse(content);

        analysis = await this.extractLanguageSpecificInfo(
          tree,
          content,
          file,
          languageInfo.language
        );
      } else {
        // Use basic analysis
        analysis = await this.extractBasicInfo(content, file, languageInfo.language);
      }

      // Add analysis to results
      this.addAnalysisToResults(analysis, file);

    } catch (error) {
      this.logger.warn(`Failed to analyze file ${file.relativePath}: ${error.message}`);
    }
  }

  /**
   * Extract basic information using regex patterns (fallback when tree-sitter is not available)
   * @param {string} content - File content
   * @param {object} file - File information
   * @param {string} language - Programming language
   * @returns {object} - Extracted information
   */
  async extractBasicInfo(content, file, language) {
    const analysis = {
      classes: [],
      functions: [],
      interfaces: [],
      imports: [],
      exports: [],
      variables: [],
      comments: []
    };

    // Basic regex patterns for different languages
    const patterns = this.getBasicPatterns(language);

    // Extract classes
    const classMatches = content.matchAll(patterns.class);
    for (const match of classMatches) {
      analysis.classes.push({
        name: match[1] || 'Unknown',
        startLine: this.getLineNumber(content, match.index),
        endLine: this.getLineNumber(content, match.index + match[0].length),
        methods: [],
        properties: [],
        modifiers: []
      });
    }

    // Extract functions
    const functionMatches = content.matchAll(patterns.function);
    for (const match of functionMatches) {
      analysis.functions.push({
        name: match[1] || 'Unknown',
        startLine: this.getLineNumber(content, match.index),
        endLine: this.getLineNumber(content, match.index + match[0].length),
        parameters: [],
        returnType: null,
        modifiers: []
      });
    }

    return analysis;
  }

  /**
   * Get basic regex patterns for a language
   * @param {string} language - Programming language
   * @returns {object} - Regex patterns
   */
  getBasicPatterns(language) {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return {
          class: /class\s+(\w+)/g,
          function: /(?:function\s+(\w+)|(\w+)\s*(?:=\s*)?(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g
        };
      case 'python':
        return {
          class: /class\s+(\w+)/g,
          function: /def\s+(\w+)/g
        };
      case 'java':
      case 'csharp':
        return {
          class: /(?:public\s+|private\s+|protected\s+)?class\s+(\w+)/g,
          function: /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:\w+\s+)?(\w+)\s*\([^)]*\)/g
        };
      case 'go':
        return {
          class: /type\s+(\w+)\s+struct/g,
          function: /func\s+(?:\([^)]*\)\s+)?(\w+)/g
        };
      case 'rust':
        return {
          class: /(?:struct|enum|trait)\s+(\w+)/g,
          function: /fn\s+(\w+)/g
        };
      default:
        return {
          class: /class\s+(\w+)/g,
          function: /function\s+(\w+)/g
        };
    }
  }

  /**
   * Get line number from character index
   * @param {string} content - File content
   * @param {number} index - Character index
   * @returns {number} - Line number
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Extract language-specific information from AST
   * @param {object} tree - Parsed AST tree
   * @param {string} content - File content
   * @param {object} file - File information
   * @param {string} language - Programming language
   * @returns {object} - Extracted information
   */
  async extractLanguageSpecificInfo(tree, content, file, language) {
    const analysis = {
      classes: [],
      functions: [],
      interfaces: [],
      imports: [],
      exports: [],
      variables: [],
      comments: []
    };

    // Walk the AST and extract information
    const walk = (node) => {
      switch (language) {
        case 'javascript':
        case 'typescript':
          this.extractJavaScriptInfo(node, analysis, content);
          break;
        case 'python':
          this.extractPythonInfo(node, analysis, content);
          break;
        case 'java':
          this.extractJavaInfo(node, analysis, content);
          break;
        case 'csharp':
          this.extractCSharpInfo(node, analysis, content);
          break;
        case 'go':
          this.extractGoInfo(node, analysis, content);
          break;
        case 'rust':
          this.extractRustInfo(node, analysis, content);
          break;
      }

      // Recursively walk child nodes
      for (let i = 0; i < node.childCount; i++) {
        walk(node.child(i));
      }
    };

    walk(tree.rootNode);
    return analysis;
  }

  /**
   * Extract JavaScript/TypeScript specific information
   * @param {object} node - AST node
   * @param {object} analysis - Analysis object
   * @param {string} content - File content
   */
  extractJavaScriptInfo(node, analysis, content) {
    switch (node.type) {
      case 'class_declaration':
        analysis.classes.push(this.extractClassInfo(node, content));
        break;
      case 'function_declaration':
      case 'method_definition':
      case 'arrow_function':
        analysis.functions.push(this.extractFunctionInfo(node, content));
        break;
      case 'interface_declaration':
        analysis.interfaces.push(this.extractInterfaceInfo(node, content));
        break;
      case 'import_statement':
        analysis.imports.push(this.extractImportInfo(node, content));
        break;
      case 'export_statement':
        analysis.exports.push(this.extractExportInfo(node, content));
        break;
    }
  }

  /**
   * Extract Python specific information
   * @param {object} node - AST node
   * @param {object} analysis - Analysis object
   * @param {string} content - File content
   */
  extractPythonInfo(node, analysis, content) {
    switch (node.type) {
      case 'class_definition':
        analysis.classes.push(this.extractClassInfo(node, content));
        break;
      case 'function_definition':
        analysis.functions.push(this.extractFunctionInfo(node, content));
        break;
      case 'import_statement':
      case 'import_from_statement':
        analysis.imports.push(this.extractImportInfo(node, content));
        break;
    }
  }

  /**
   * Extract Java specific information
   * @param {object} node - AST node
   * @param {object} analysis - Analysis object
   * @param {string} content - File content
   */
  extractJavaInfo(node, analysis, content) {
    switch (node.type) {
      case 'class_declaration':
      case 'interface_declaration':
        analysis.classes.push(this.extractClassInfo(node, content));
        break;
      case 'method_declaration':
        analysis.functions.push(this.extractFunctionInfo(node, content));
        break;
      case 'import_declaration':
        analysis.imports.push(this.extractImportInfo(node, content));
        break;
    }
  }

  /**
   * Extract C# specific information
   * @param {object} node - AST node
   * @param {object} analysis - Analysis object
   * @param {string} content - File content
   */
  extractCSharpInfo(node, analysis, content) {
    switch (node.type) {
      case 'class_declaration':
      case 'interface_declaration':
        analysis.classes.push(this.extractClassInfo(node, content));
        break;
      case 'method_declaration':
        analysis.functions.push(this.extractFunctionInfo(node, content));
        break;
      case 'using_directive':
        analysis.imports.push(this.extractImportInfo(node, content));
        break;
    }
  }

  /**
   * Extract Go specific information
   * @param {object} node - AST node
   * @param {object} analysis - Analysis object
   * @param {string} content - File content
   */
  extractGoInfo(node, analysis, content) {
    switch (node.type) {
      case 'type_declaration':
        analysis.classes.push(this.extractClassInfo(node, content));
        break;
      case 'function_declaration':
      case 'method_declaration':
        analysis.functions.push(this.extractFunctionInfo(node, content));
        break;
      case 'import_declaration':
        analysis.imports.push(this.extractImportInfo(node, content));
        break;
    }
  }

  /**
   * Extract Rust specific information
   * @param {object} node - AST node
   * @param {object} analysis - Analysis object
   * @param {string} content - File content
   */
  extractRustInfo(node, analysis, content) {
    switch (node.type) {
      case 'struct_item':
      case 'enum_item':
      case 'trait_item':
        analysis.classes.push(this.extractClassInfo(node, content));
        break;
      case 'function_item':
        analysis.functions.push(this.extractFunctionInfo(node, content));
        break;
      case 'use_declaration':
        analysis.imports.push(this.extractImportInfo(node, content));
        break;
    }
  }

  // Helper methods for extracting specific information
  extractClassInfo(node, content) {
    return {
      name: this.getNodeText(node, content, 'name') || 'Unknown',
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      methods: [],
      properties: [],
      modifiers: []
    };
  }

  extractFunctionInfo(node, content) {
    return {
      name: this.getNodeText(node, content, 'name') || 'Unknown',
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      parameters: [],
      returnType: null,
      modifiers: []
    };
  }

  extractInterfaceInfo(node, content) {
    return {
      name: this.getNodeText(node, content, 'name') || 'Unknown',
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      methods: [],
      properties: []
    };
  }

  extractImportInfo(node, content) {
    return {
      module: this.getNodeText(node, content) || 'Unknown',
      startLine: node.startPosition.row + 1
    };
  }

  extractExportInfo(node, content) {
    return {
      name: this.getNodeText(node, content) || 'Unknown',
      startLine: node.startPosition.row + 1
    };
  }

  /**
   * Get text content of a node
   * @param {object} node - AST node
   * @param {string} content - File content
   * @param {string} field - Specific field to extract
   * @returns {string} - Node text
   */
  getNodeText(node, content, field = null) {
    try {
      if (field && node.childForFieldName) {
        const fieldNode = node.childForFieldName(field);
        if (fieldNode) {
          return content.slice(fieldNode.startIndex, fieldNode.endIndex);
        }
      }
      return content.slice(node.startIndex, node.endIndex);
    } catch (error) {
      return null;
    }
  }

  /**
   * Add analysis results to main result object
   * @param {object} analysis - File analysis
   * @param {object} file - File information
   */
  addAnalysisToResults(analysis, file) {
    // Add classes
    analysis.classes.forEach(cls => {
      this.analysisResult.classes.push({
        ...cls,
        file: file.relativePath,
        language: file.language
      });
    });

    // Add functions
    analysis.functions.forEach(func => {
      this.analysisResult.functions.push({
        ...func,
        file: file.relativePath,
        language: file.language
      });
    });

    // Add interfaces
    analysis.interfaces.forEach(iface => {
      this.analysisResult.interfaces.push({
        ...iface,
        file: file.relativePath,
        language: file.language
      });
    });

    // Add dependencies
    analysis.imports.forEach(imp => {
      this.analysisResult.dependencies.push({
        from: file.relativePath,
        to: imp.module,
        type: 'import'
      });
    });
  }

  /**
   * Calculate code metrics
   */
  calculateMetrics() {
    this.analysisResult.metrics = {
      totalFiles: this.analysisResult.files.length,
      totalClasses: this.analysisResult.classes.length,
      totalFunctions: this.analysisResult.functions.length,
      totalInterfaces: this.analysisResult.interfaces.length,
      languageDistribution: this.calculateLanguageDistribution(),
      complexityMetrics: this.calculateComplexityMetrics()
    };
  }

  /**
   * Calculate language distribution
   * @returns {object} - Language distribution
   */
  calculateLanguageDistribution() {
    const distribution = {};
    this.analysisResult.files.forEach(file => {
      distribution[file.language] = (distribution[file.language] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Calculate complexity metrics
   * @returns {object} - Complexity metrics
   */
  calculateComplexityMetrics() {
    return {
      averageFunctionsPerFile: this.analysisResult.functions.length / this.analysisResult.files.length || 0,
      averageClassesPerFile: this.analysisResult.classes.length / this.analysisResult.files.length || 0,
      totalDependencies: this.analysisResult.dependencies.length
    };
  }

  /**
   * Build dependency graph
   */
  buildDependencyGraph() {
    // This is a simplified implementation
    // In a production environment, you'd build a more sophisticated dependency graph
    this.analysisResult.structure = {
      modules: this.groupByModule(),
      dependencies: this.analysisResult.dependencies
    };
  }

  /**
   * Group analysis results by module/directory
   * @returns {object} - Grouped modules
   */
  groupByModule() {
    const modules = {};
    
    this.analysisResult.files.forEach(file => {
      const dir = path.dirname(file.relativePath);
      if (!modules[dir]) {
        modules[dir] = {
          path: dir,
          files: [],
          classes: [],
          functions: []
        };
      }
      modules[dir].files.push(file);
    });

    // Add classes and functions to modules
    this.analysisResult.classes.forEach(cls => {
      const dir = path.dirname(cls.file);
      if (modules[dir]) {
        modules[dir].classes.push(cls);
      }
    });

    this.analysisResult.functions.forEach(func => {
      const dir = path.dirname(func.file);
      if (modules[dir]) {
        modules[dir].functions.push(func);
      }
    });

    return modules;
  }

  /**
   * Split array into chunks
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} - Chunked array
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

module.exports = CodeAnalyzer;
