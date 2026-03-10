import type { NextApiRequest, NextApiResponse } from 'next';

interface ScholarResponse {
    totalCitations: number;
    hIndex: number;
    i10Index: number;
    publications: number;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ScholarResponse | { error: string }>
) {
    const { authorId } = req.query;

    if (!authorId || typeof authorId !== 'string') {
        return res.status(400).json({ error: 'authorId query parameter is required' });
    }

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'SERPAPI_KEY not configured on server' });
    }

    try {
        const url = `https://serpapi.com/search.json?engine=google_scholar_author&author_id=${encodeURIComponent(authorId)}&api_key=${encodeURIComponent(apiKey)}`;

        const serpRes = await fetch(url);

        if (!serpRes.ok) {
            return res.status(serpRes.status).json({
                error: `SerpAPI error: ${serpRes.statusText}`,
            });
        }

        const data = await serpRes.json();

        // Extract citation metrics from the cited_by table
        const citedBy = data.cited_by?.table || [];
        let totalCitations = 0;
        let hIndex = 0;
        let i10Index = 0;

        for (const row of citedBy) {
            if (row.citations) {
                totalCitations = row.citations.all || 0;
            }
            if (row.h_index) {
                hIndex = row.h_index.all || 0;
            }
            if (row.i10_index) {
                i10Index = row.i10_index.all || 0;
            }
        }

        const publications = data.articles?.length || 0;

        const result: ScholarResponse = {
            totalCitations,
            hIndex,
            i10Index,
            publications,
        };

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(result);
    } catch (error) {
        console.error('Scholar API error:', error);
        return res.status(500).json({ error: 'Failed to fetch Google Scholar data' });
    }
}
