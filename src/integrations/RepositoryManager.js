const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');
const Logger = require('../utils/Logger');

/**
 * Manages repository operations for GitHub and Azure DevOps
 */
class RepositoryManager {
  constructor() {
    this.logger = new Logger();
    this.tempDir = null;
    this.git = null;
  }

  /**
   * Clone repository from GitHub or Azure DevOps
   * @param {string} repositoryUrl - Repository URL
   * @param {string} branch - Branch name
   * @returns {string} - Path to cloned repository
   */
  async cloneRepository(repositoryUrl, branch = 'main') {
    try {
      // Create temporary directory
      this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-maker-'));
      this.logger.info(`Created temporary directory: ${this.tempDir}`);

      // Determine repository type and prepare clone URL
      const repoInfo = this.parseRepositoryUrl(repositoryUrl);
      const cloneUrl = this.prepareCloneUrl(repoInfo);

      // Initialize git
      this.git = simpleGit();

      // Clone repository
      this.logger.info(`Cloning repository: ${repositoryUrl}`);
      await this.git.clone(cloneUrl, this.tempDir, ['--depth', '1', '--branch', branch]);

      this.logger.success(`Repository cloned successfully to: ${this.tempDir}`);
      return this.tempDir;

    } catch (error) {
      this.logger.error('Failed to clone repository:', error);
      await this.cleanup();
      throw new Error(`Repository clone failed: ${error.message}`);
    }
  }

  /**
   * Parse repository URL to extract platform and repository information
   * @param {string} url - Repository URL
   * @returns {object} - Repository information
   */
  parseRepositoryUrl(url) {
    // GitHub URL patterns
    const githubPattern = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/;
    const githubMatch = url.match(githubPattern);

    if (githubMatch) {
      return {
        platform: 'github',
        owner: githubMatch[1],
        repo: githubMatch[2],
        originalUrl: url
      };
    }

    // Azure DevOps URL patterns
    const azurePattern = /^https?:\/\/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/]+?)(?:\/.*)?$/;
    const azureMatch = url.match(azurePattern);

    if (azureMatch) {
      return {
        platform: 'azure-devops',
        organization: azureMatch[1],
        project: azureMatch[2],
        repo: azureMatch[3],
        originalUrl: url
      };
    }

    // Alternative Azure DevOps pattern
    const azureAltPattern = /^https?:\/\/([^\.]+)\.visualstudio\.com\/([^\/]+)\/_git\/([^\/]+?)(?:\/.*)?$/;
    const azureAltMatch = url.match(azureAltPattern);

    if (azureAltMatch) {
      return {
        platform: 'azure-devops',
        organization: azureAltMatch[1],
        project: azureAltMatch[2],
        repo: azureAltMatch[3],
        originalUrl: url
      };
    }

    throw new Error(`Unsupported repository URL format: ${url}`);
  }

  /**
   * Prepare clone URL based on repository platform
   * @param {object} repoInfo - Repository information
   * @returns {string} - Clone URL
   */
  prepareCloneUrl(repoInfo) {
    switch (repoInfo.platform) {
      case 'github':
        return `https://github.com/${repoInfo.owner}/${repoInfo.repo}.git`;

      case 'azure-devops':
        if (repoInfo.organization && repoInfo.project) {
          return `https://dev.azure.com/${repoInfo.organization}/${repoInfo.project}/_git/${repoInfo.repo}`;
        }
        return repoInfo.originalUrl;

      default:
        throw new Error(`Unsupported platform: ${repoInfo.platform}`);
    }
  }

  /**
   * Get repository metadata
   * @param {string} repositoryPath - Path to repository
   * @returns {object} - Repository metadata
   */
  async getRepositoryMetadata(repositoryPath) {
    try {
      const git = simpleGit(repositoryPath);
      
      // Get current branch
      const status = await git.status();
      const currentBranch = status.current;

      // Get latest commit
      const log = await git.log(['-1']);
      const latestCommit = log.latest;

      // Get remote URL
      const remotes = await git.getRemotes(true);
      const originRemote = remotes.find(remote => remote.name === 'origin');

      // Get repository statistics
      const stats = await this.getRepositoryStats(repositoryPath);

      return {
        branch: currentBranch,
        latestCommit: {
          hash: latestCommit.hash,
          message: latestCommit.message,
          author: latestCommit.author_name,
          date: latestCommit.date
        },
        remoteUrl: originRemote ? originRemote.refs.fetch : null,
        stats
      };

    } catch (error) {
      this.logger.error('Failed to get repository metadata:', error);
      return null;
    }
  }

  /**
   * Get repository statistics
   * @param {string} repositoryPath - Path to repository
   * @returns {object} - Repository statistics
   */
  async getRepositoryStats(repositoryPath) {
    try {
      const stats = {
        totalFiles: 0,
        codeFiles: 0,
        directories: 0,
        fileTypes: {}
      };

      const walk = async (dir) => {
        const items = await fs.readdir(dir);
        
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = await fs.stat(itemPath);

          if (stat.isDirectory()) {
            // Skip .git and node_modules directories
            if (!item.startsWith('.') && item !== 'node_modules') {
              stats.directories++;
              await walk(itemPath);
            }
          } else {
            stats.totalFiles++;
            
            const ext = path.extname(item).toLowerCase();
            if (this.isCodeFile(ext)) {
              stats.codeFiles++;
            }
            
            stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
          }
        }
      };

      await walk(repositoryPath);
      return stats;

    } catch (error) {
      this.logger.error('Failed to get repository stats:', error);
      return null;
    }
  }

  /**
   * Check if file extension represents a code file
   * @param {string} extension - File extension
   * @returns {boolean} - True if it's a code file
   */
  isCodeFile(extension) {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.go', '.rs',
      '.cpp', '.c', '.h', '.hpp', '.php', '.rb', '.swift', '.kt', '.scala',
      '.clj', '.hs', '.ml', '.fs', '.vb', '.pl', '.sh', '.ps1', '.sql'
    ];
    return codeExtensions.includes(extension);
  }

  /**
   * Cleanup temporary files
   */
  async cleanup() {
    if (this.tempDir) {
      try {
        await fs.remove(this.tempDir);
        this.logger.info(`Cleaned up temporary directory: ${this.tempDir}`);
        this.tempDir = null;
      } catch (error) {
        this.logger.warn(`Failed to cleanup temporary directory: ${error.message}`);
      }
    }
  }

  /**
   * Get available branches for a repository
   * @param {string} repositoryUrl - Repository URL
   * @returns {Array} - List of branch names
   */
  async getBranches(repositoryUrl) {
    try {
      const repoInfo = this.parseRepositoryUrl(repositoryUrl);
      
      // This is a simplified implementation
      // In a production environment, you'd use the respective APIs
      return ['main', 'master', 'develop', 'dev'];
      
    } catch (error) {
      this.logger.error('Failed to get branches:', error);
      return ['main'];
    }
  }
}

module.exports = RepositoryManager;
