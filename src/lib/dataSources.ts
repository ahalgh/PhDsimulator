/**
 * Direct client-side implementations for public APIs.
 * Used on static hosts (GitHub Pages) where server-side routes aren't available.
 * GitHub and ORCID are fully public APIs that support browser CORS requests.
 */

import type { GitHubData, OrcidData } from './progressCalculator';

/**
 * Fetch GitHub stats directly from the GitHub REST API.
 * No token required — works at 60 req/hour for public profiles.
 * When a backend is available with GITHUB_TOKEN, use the /api/github route instead
 * (it upgrades to GraphQL for accurate commit counts).
 */
export async function fetchGitHubDirect(username: string): Promise<GitHubData> {
    const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PhD-Simulator',
    };

    const reposRes = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
        { headers }
    );
    if (!reposRes.ok) throw new Error(`GitHub repos: ${reposRes.statusText}`);
    const repos = await reposRes.json();

    // Estimate commits from repo size (heuristic — GraphQL gives real counts but needs auth)
    let totalCommits = 0;
    for (const repo of repos) {
        if (repo.fork) continue;
        totalCommits += Math.max(repo.size / 10, 1);
    }
    totalCommits = Math.floor(totalCommits);

    // Search API for PRs + issues (30 unauthenticated requests/hour)
    const [prRes, issueRes] = await Promise.allSettled([
        fetch(
            `https://api.github.com/search/issues?q=author:${encodeURIComponent(username)}+type:pr+is:merged&per_page=1`,
            { headers }
        ),
        fetch(
            `https://api.github.com/search/issues?q=author:${encodeURIComponent(username)}+type:issue+is:closed&per_page=1`,
            { headers }
        ),
    ]);

    const prData = prRes.status === 'fulfilled' && prRes.value.ok
        ? await prRes.value.json()
        : { total_count: 0 };
    const issueData = issueRes.status === 'fulfilled' && issueRes.value.ok
        ? await issueRes.value.json()
        : { total_count: 0 };

    return {
        totalCommits,
        totalPRsMerged: prData.total_count || 0,
        totalIssuesClosed: issueData.total_count || 0,
    };
}

/**
 * Fetch ORCID data directly from the public ORCID API.
 * No credentials required — ORCID is a fully open public API with CORS headers.
 */
export async function fetchOrcidDirect(orcidId: string): Promise<OrcidData> {
    const headers: HeadersInit = { 'Accept': 'application/json' };
    const base = `https://pub.orcid.org/v3.0/${encodeURIComponent(orcidId)}`;

    const [worksRes, eduRes] = await Promise.allSettled([
        fetch(`${base}/works`, { headers }),
        fetch(`${base}/educations`, { headers }),
    ]);

    let totalPublications = 0;
    let educationEntries = 0;

    if (worksRes.status === 'fulfilled' && worksRes.value.ok) {
        const works = await worksRes.value.json();
        totalPublications = works?.group?.length ?? 0;
    }

    if (eduRes.status === 'fulfilled' && eduRes.value.ok) {
        const edu = await eduRes.value.json();
        educationEntries = edu?.['education-summary']?.length ?? 0;
    }

    return { totalPublications, educationEntries };
}
