import type { NextApiRequest, NextApiResponse } from 'next';

interface GitHubResponse {
    totalCommits: number;
    totalPRsMerged: number;
    totalIssuesClosed: number;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<GitHubResponse | { error: string }>
) {
    const { username } = req.query;

    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'username query parameter is required' });
    }

    try {
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'PhD-Simulator',
        };

        // Use token if available for higher rate limits
        if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
        }

        // Fetch repos
        const reposRes = await fetch(
            `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
            { headers }
        );

        if (!reposRes.ok) {
            return res.status(reposRes.status).json({ error: `GitHub API error: ${reposRes.statusText}` });
        }

        const repos = await reposRes.json();

        // Estimate total commits from repo sizes (rough heuristic)
        // A more accurate approach would fetch contributor stats per repo, but that's rate-limit heavy
        let totalCommits = 0;
        for (const repo of repos) {
            if (repo.fork) continue;
            totalCommits += Math.max(repo.size / 10, 1);
        }
        totalCommits = Math.floor(totalCommits);

        // Fetch merged PRs count
        const prRes = await fetch(
            `https://api.github.com/search/issues?q=author:${encodeURIComponent(username)}+type:pr+is:merged&per_page=1`,
            { headers }
        );
        const prData = prRes.ok ? await prRes.json() : { total_count: 0 };

        // Fetch closed issues count
        const issueRes = await fetch(
            `https://api.github.com/search/issues?q=author:${encodeURIComponent(username)}+type:issue+is:closed&per_page=1`,
            { headers }
        );
        const issueData = issueRes.ok ? await issueRes.json() : { total_count: 0 };

        const result: GitHubResponse = {
            totalCommits,
            totalPRsMerged: prData.total_count || 0,
            totalIssuesClosed: issueData.total_count || 0,
        };

        // Cache for 1 hour
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(result);
    } catch (error) {
        console.error('GitHub API error:', error);
        return res.status(500).json({ error: 'Failed to fetch GitHub data' });
    }
}
