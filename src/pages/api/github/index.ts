import type { NextApiRequest, NextApiResponse } from 'next';

interface GitHubResponse {
    totalCommits: number;
    totalPRsMerged: number;
    totalIssuesClosed: number;
}

// Use GitHub GraphQL API for accurate commit counts
async function fetchViaGraphQL(
    username: string,
    headers: Record<string, string>
): Promise<GitHubResponse> {
    const query = `
        query($username: String!) {
            user(login: $username) {
                contributionsCollection {
                    totalCommitContributions
                    restrictedContributionsCount
                }
                pullRequests(states: MERGED) { totalCount }
                issues(states: CLOSED) { totalCount }
            }
        }
    `;

    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: { username } }),
    });

    if (!res.ok) {
        throw new Error(`GraphQL request failed: ${res.statusText}`);
    }

    const json = await res.json();

    if (json.errors) {
        throw new Error(`GraphQL errors: ${json.errors.map((e: { message: string }) => e.message).join(', ')}`);
    }

    const user = json.data?.user;
    if (!user) {
        throw new Error(`User "${username}" not found`);
    }

    const cc = user.contributionsCollection;
    return {
        totalCommits: cc.totalCommitContributions + cc.restrictedContributionsCount,
        totalPRsMerged: user.pullRequests.totalCount,
        totalIssuesClosed: user.issues.totalCount,
    };
}

// Fallback: REST API with repo-size heuristic (no token required)
async function fetchViaREST(
    username: string,
    headers: Record<string, string>
): Promise<GitHubResponse> {
    // Fetch repos
    const reposRes = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
        { headers }
    );

    if (!reposRes.ok) {
        throw new Error(`GitHub API error: ${reposRes.statusText}`);
    }

    const repos = await reposRes.json();

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

    return {
        totalCommits,
        totalPRsMerged: prData.total_count || 0,
        totalIssuesClosed: issueData.total_count || 0,
    };
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

        if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
        }

        let result: GitHubResponse;

        // GraphQL requires authentication — use it when token is available
        if (process.env.GITHUB_TOKEN) {
            try {
                result = await fetchViaGraphQL(username, headers);
            } catch (gqlError) {
                console.warn('GraphQL failed, falling back to REST:', gqlError);
                result = await fetchViaREST(username, headers);
            }
        } else {
            // No token — REST only (GraphQL requires auth)
            result = await fetchViaREST(username, headers);
        }

        // Cache for 1 hour
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(result);
    } catch (error) {
        console.error('GitHub API error:', error);
        return res.status(500).json({ error: 'Failed to fetch GitHub data' });
    }
}
