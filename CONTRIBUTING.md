# Contributing to Documentation Maker

Thank you for your interest in contributing to Documentation Maker! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Adding New Features](#adding-new-features)

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/documentation-maker.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/documentation-maker.git
cd documentation-maker

# Install dependencies
npm install

# Run tests to ensure everything is working
npm test
```

### Running the Development Version

```bash
# Run the CLI tool directly
node src/cli.js --help

# Test with a sample repository
node src/cli.js generate --url https://github.com/user/repo --interactive
```

## Project Structure

```
documentation-maker/
├── src/
│   ├── analyzers/          # Code analysis modules
│   │   └── CodeAnalyzer.js
│   ├── generators/         # Documentation generators
│   │   └── DocumentationGenerator.js
│   ├── integrations/       # Repository integrations
│   │   └── RepositoryManager.js
│   ├── templates/          # Documentation templates
│   │   ├── standard/
│   │   ├── minimal/
│   │   └── detailed/
│   ├── utils/              # Utility functions
│   │   ├── ConfigManager.js
│   │   └── Logger.js
│   ├── cli.js              # Command-line interface
│   └── DocumentationMaker.js # Main class
├── tests/                  # Test files
├── docs/                   # Generated documentation
└── templates/              # User templates
```

## Coding Standards

### JavaScript Style

- Use ES6+ features where appropriate
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public methods
- Use async/await for asynchronous operations

### Example:

```javascript
/**
 * Analyze repository code structure
 * @param {string} repositoryPath - Path to repository
 * @returns {Promise<object>} - Analysis result
 */
async function analyzeRepository(repositoryPath) {
  // Implementation
}
```

### Error Handling

- Always handle errors appropriately
- Use descriptive error messages
- Log errors with appropriate level
- Throw errors with context

```javascript
try {
  const result = await someOperation();
  return result;
} catch (error) {
  this.logger.error('Operation failed:', error);
  throw new Error(`Failed to perform operation: ${error.message}`);
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/DocumentationMaker.test.js
```

### Writing Tests

- Write tests for all new functionality
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies
- Aim for high test coverage

### Test Structure

```javascript
describe('ClassName', () => {
  describe('methodName', () => {
    test('should do something when condition is met', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = method(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

## Submitting Changes

### Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add tests for new functionality
4. Follow the commit message format
5. Submit pull request with clear description

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(analyzer): add support for Rust language parsing
fix(cli): handle invalid repository URLs gracefully
docs(readme): update installation instructions
```

### Pull Request Checklist

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Commit messages follow format
- [ ] No merge conflicts
- [ ] Feature is backward compatible

## Adding New Features

### Adding Language Support

1. Install the tree-sitter parser: `npm install tree-sitter-language`
2. Add language to `CodeAnalyzer.js`:
   ```javascript
   const NewLanguage = require('tree-sitter-language');
   
   // In initializeLanguageMap()
   '.ext': { parser: NewLanguage, language: 'language-name' }
   ```
3. Implement language-specific extraction method
4. Add tests for the new language
5. Update documentation

### Adding Output Formats

1. Create format-specific template in `DocumentationGenerator.js`
2. Add format to supported formats list
3. Implement format-specific processing
4. Add tests for the new format
5. Update CLI options and documentation

### Adding Templates

1. Create template directory in `src/templates/`
2. Add template files (markdown.hbs, html.hbs)
3. Test template with sample data
4. Add template to available templates list
5. Document template usage

## Code Review Guidelines

### For Contributors

- Keep pull requests focused and small
- Provide clear description of changes
- Respond to feedback promptly
- Be open to suggestions and improvements

### For Reviewers

- Be constructive and helpful
- Focus on code quality and maintainability
- Check for test coverage
- Verify documentation updates
- Test the changes locally

## Getting Help

- Create an issue for bugs or feature requests
- Join discussions in existing issues
- Ask questions in pull request comments
- Check existing documentation and tests

## License

By contributing to Documentation Maker, you agree that your contributions will be licensed under the MIT License.
