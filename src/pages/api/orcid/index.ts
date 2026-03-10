import type { NextApiRequest, NextApiResponse } from 'next';

interface OrcidResponse {
    totalPublications: number;
    educationEntries: number;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<OrcidResponse | { error: string }>
) {
    const { orcidId } = req.query;

    if (!orcidId || typeof orcidId !== 'string') {
        return res.status(400).json({ error: 'orcidId query parameter is required' });
    }

    // Validate ORCID format (0000-0000-0000-0000)
    if (!/^\d{4}-\d{4}-\d{4}-\d{4}$/.test(orcidId)) {
        return res.status(400).json({ error: 'Invalid ORCID format. Expected: 0000-0000-0000-0000' });
    }

    try {
        // Fetch works (publications)
        const worksRes = await fetch(
            `https://pub.orcid.org/v3.0/${orcidId}/works`,
            {
                headers: {
                    'Accept': 'application/json',
                },
            }
        );

        if (!worksRes.ok) {
            return res.status(worksRes.status).json({ error: `ORCID API error: ${worksRes.statusText}` });
        }

        const worksData = await worksRes.json();
        const totalPublications = worksData.group?.length || 0;

        // Fetch education
        const eduRes = await fetch(
            `https://pub.orcid.org/v3.0/${orcidId}/educations`,
            {
                headers: {
                    'Accept': 'application/json',
                },
            }
        );

        const eduData = eduRes.ok ? await eduRes.json() : { 'education-summary': [] };
        const educationEntries = eduData['affiliation-group']?.length || 0;

        const result: OrcidResponse = {
            totalPublications,
            educationEntries,
        };

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(result);
    } catch (error) {
        console.error('ORCID API error:', error);
        return res.status(500).json({ error: 'Failed to fetch ORCID data' });
    }
}
