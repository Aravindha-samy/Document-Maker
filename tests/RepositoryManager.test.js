const RepositoryManager = require('../src/integrations/RepositoryManager');

describe('RepositoryManager', () => {
  let repoManager;

  beforeEach(() => {
    repoManager = new RepositoryManager();
  });

  afterEach(async () => {
    await repoManager.cleanup();
  });

  describe('parseRepositoryUrl', () => {
    test('should parse GitHub URL correctly', () => {
      const url = 'https://github.com/user/repo';
      const result = repoManager.parseRepositoryUrl(url);
      
      expect(result.platform).toBe('github');
      expect(result.owner).toBe('user');
      expect(result.repo).toBe('repo');
    });

    test('should parse GitHub URL with .git extension', () => {
      const url = 'https://github.com/user/repo.git';
      const result = repoManager.parseRepositoryUrl(url);
      
      expect(result.platform).toBe('github');
      expect(result.owner).toBe('user');
      expect(result.repo).toBe('repo');
    });

    test('should parse Azure DevOps URL correctly', () => {
      const url = 'https://dev.azure.com/org/project/_git/repo';
      const result = repoManager.parseRepositoryUrl(url);
      
      expect(result.platform).toBe('azure-devops');
      expect(result.organization).toBe('org');
      expect(result.project).toBe('project');
      expect(result.repo).toBe('repo');
    });

    test('should parse alternative Azure DevOps URL format', () => {
      const url = 'https://org.visualstudio.com/project/_git/repo';
      const result = repoManager.parseRepositoryUrl(url);
      
      expect(result.platform).toBe('azure-devops');
      expect(result.organization).toBe('org');
      expect(result.project).toBe('project');
      expect(result.repo).toBe('repo');
    });

    test('should throw error for unsupported URL', () => {
      const url = 'https://gitlab.com/user/repo';
      expect(() => repoManager.parseRepositoryUrl(url)).toThrow('Unsupported repository URL format');
    });
  });

  describe('prepareCloneUrl', () => {
    test('should prepare GitHub clone URL', () => {
      const repoInfo = {
        platform: 'github',
        owner: 'user',
        repo: 'repo'
      };
      
      const cloneUrl = repoManager.prepareCloneUrl(repoInfo);
      expect(cloneUrl).toBe('https://github.com/user/repo.git');
    });

    test('should prepare Azure DevOps clone URL', () => {
      const repoInfo = {
        platform: 'azure-devops',
        organization: 'org',
        project: 'project',
        repo: 'repo'
      };
      
      const cloneUrl = repoManager.prepareCloneUrl(repoInfo);
      expect(cloneUrl).toBe('https://dev.azure.com/org/project/_git/repo');
    });

    test('should throw error for unsupported platform', () => {
      const repoInfo = {
        platform: 'unsupported'
      };
      
      expect(() => repoManager.prepareCloneUrl(repoInfo)).toThrow('Unsupported platform');
    });
  });

  describe('isCodeFile', () => {
    test('should identify JavaScript files as code files', () => {
      expect(repoManager.isCodeFile('.js')).toBe(true);
      expect(repoManager.isCodeFile('.jsx')).toBe(true);
      expect(repoManager.isCodeFile('.ts')).toBe(true);
      expect(repoManager.isCodeFile('.tsx')).toBe(true);
    });

    test('should identify Python files as code files', () => {
      expect(repoManager.isCodeFile('.py')).toBe(true);
    });

    test('should identify Java files as code files', () => {
      expect(repoManager.isCodeFile('.java')).toBe(true);
    });

    test('should not identify non-code files as code files', () => {
      expect(repoManager.isCodeFile('.txt')).toBe(false);
      expect(repoManager.isCodeFile('.md')).toBe(false);
      expect(repoManager.isCodeFile('.json')).toBe(false);
      expect(repoManager.isCodeFile('.png')).toBe(false);
    });
  });

  describe('getBranches', () => {
    test('should return default branches for any repository', async () => {
      const branches = await repoManager.getBranches('https://github.com/user/repo');
      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBeGreaterThan(0);
      expect(branches).toContain('main');
    });
  });
});
