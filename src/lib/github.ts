import repositoriesConfig from '@/config/source-repositories.json';
import {
  loadTrackedRepositories as loadTrackedRepositoriesFromDb,
  upsertRepository,
  getRepositoryById,
} from '@/lib/supabase-adapter';

export interface RepositoryPathConfig {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  paths: string[];
}

export interface TrackedRepository extends RepositoryPathConfig {
  lastCommitSha?: string;
  lastChecked?: string;
}

interface GitHubFileResponse {
  type: 'file' | 'dir';
  name: string;
  path: string;
  download_url?: string;
  encoding?: string;
  content?: string;
}

class GitHubService {
  private readonly apiBaseUrl = 'https://api.github.com';
  private readonly token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'iptv-fusion-hub',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });
    if (!response.ok) {
      throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  async getLatestCommitSha(owner: string, repo: string, branch: string): Promise<string> {
    const url = `${this.apiBaseUrl}/repos/${owner}/${repo}/commits/${branch}`;
    const data = await this.fetchJson<{ sha: string }>(url);
    return data.sha;
  }

  async getFileContent(owner: string, repo: string, filePath: string, branch: string): Promise<string> {
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const url = `${this.apiBaseUrl}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`;
    const data = await this.fetchJson<GitHubFileResponse>(url);
    if (data.encoding === 'base64' && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    if (data.download_url) {
      const response = await fetch(data.download_url);
      return response.text();
    }
    return data.content ?? '';
  }

  async getDirectoryEntries(
    owner: string,
    repo: string,
    directoryPath: string,
    branch: string,
  ): Promise<GitHubFileResponse[]> {
    const encodedPath = directoryPath.split('/').map(encodeURIComponent).join('/');
    const url = `${this.apiBaseUrl}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`;
    return this.fetchJson<GitHubFileResponse[]>(url);
  }
}

export class RepositoryTracker {
  private readonly service: GitHubService;

  constructor() {
    this.service = new GitHubService(process.env.GITHUB_TOKEN);
  }

  async loadTrackedRepositories(): Promise<TrackedRepository[]> {
    return loadTrackedRepositoriesFromDb();
  }

  async initializeDefaultRepositories(): Promise<TrackedRepository[]> {
    const configured = repositoriesConfig.repositories as RepositoryPathConfig[];
    const tracked: TrackedRepository[] = [];
    for (const repoConfig of configured) {
      const existing = await getRepositoryById(repoConfig.id);
      if (existing) {
        tracked.push(existing);
        continue;
      }
      const latestSha = await this.service.getLatestCommitSha(
        repoConfig.owner,
        repoConfig.repo,
        repoConfig.branch,
      );
      const trackedRepo: TrackedRepository = {
        ...repoConfig,
        lastCommitSha: latestSha,
        lastChecked: new Date().toISOString(),
      };
      await upsertRepository(trackedRepo);
      tracked.push(trackedRepo);
    }
    return tracked;
  }

  async checkForUpdates(): Promise<TrackedRepository[]> {
    const tracked = await this.loadTrackedRepositories();
    if (tracked.length === 0) {
      return this.initializeDefaultRepositories();
    }
    const changed: TrackedRepository[] = [];
    for (const repo of tracked) {
      const latestSha = await this.service.getLatestCommitSha(
        repo.owner,
        repo.repo,
        repo.branch,
      );
      if (repo.lastCommitSha !== latestSha) {
        const updated: TrackedRepository = {
          ...repo,
          lastCommitSha: latestSha,
          lastChecked: new Date().toISOString(),
        };
        await upsertRepository(updated);
        changed.push(updated);
      }
    }
    return changed;
  }

  async isRepositoryTracked(owner: string, repo: string): Promise<boolean> {
    const tracked = await this.loadTrackedRepositories();
    return tracked.some(function checkMatch(trackedRepo) {
      return trackedRepo.owner === owner && trackedRepo.repo === repo;
    });
  }

  async fetchUpdatedFiles(repository: TrackedRepository): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    for (const targetPath of repository.paths) {
      if (targetPath.endsWith('/')) {
        const entries = await this.service.getDirectoryEntries(
          repository.owner,
          repository.repo,
          targetPath,
          repository.branch,
        );
        for (const entry of entries) {
          if (entry.type === 'file') {
            const content = await this.service.getFileContent(
              repository.owner,
              repository.repo,
              entry.path,
              repository.branch,
            );
            files[entry.path] = content;
          }
        }
      } else {
        const content = await this.service.getFileContent(
          repository.owner,
          repository.repo,
          targetPath,
          repository.branch,
        );
        files[targetPath] = content;
      }
    }
    return files;
  }
}

