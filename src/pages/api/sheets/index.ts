import type { NextApiRequest, NextApiResponse } from 'next';

interface SheetsResponse {
    tasksCompleted: number;
    coursesCompleted: number;
    skillsLearned: number;
    milestonesCompleted: number;
    conferences: Array<{ name: string; theme: string; location?: string }>;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SheetsResponse | { error: string }>
) {
    const { spreadsheetId } = req.query;

    if (!spreadsheetId || typeof spreadsheetId !== 'string') {
        return res.status(400).json({ error: 'spreadsheetId query parameter is required' });
    }

    // For MVP, use the published CSV approach (simpler, no service account needed)
    // The user publishes their sheet as CSV and we fetch it
    // Later, we can upgrade to the full Google Sheets API v4 with googleapis

    try {
        // Try to fetch the sheet as a published CSV
        // The sheet needs to be published: File > Share > Publish to web > CSV
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

        const csvRes = await fetch(csvUrl);

        if (!csvRes.ok) {
            // If published CSV doesn't work, return empty data
            // The user can configure their sheet later via the admin panel
            return res.status(200).json({
                tasksCompleted: 0,
                coursesCompleted: 0,
                skillsLearned: 0,
                milestonesCompleted: 0,
                conferences: [],
            });
        }

        const csvText = await csvRes.text();
        const rows = parseCSV(csvText);

        // Parse the sheet data with flexible column detection
        // Look for common column headers
        const headerRow = rows[0] || [];
        const headers = headerRow.map(h => h.toLowerCase().trim());

        // Find relevant column indices
        const statusIdx = findColumnIndex(headers, ['status', 'done', 'completed', 'complete']);
        const typeIdx = findColumnIndex(headers, ['type', 'category', 'kind']);
        const nameIdx = findColumnIndex(headers, ['name', 'task', 'title', 'item', 'description']);
        const locationIdx = findColumnIndex(headers, ['location', 'city', 'place', 'venue']);

        let tasksCompleted = 0;
        let coursesCompleted = 0;
        let skillsLearned = 0;
        let milestonesCompleted = 0;
        const conferences: Array<{ name: string; theme: string; location?: string }> = [];

        // Parse data rows
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const status = statusIdx >= 0 ? row[statusIdx]?.toLowerCase().trim() : '';
            const type = typeIdx >= 0 ? row[typeIdx]?.toLowerCase().trim() : '';
            const name = nameIdx >= 0 ? row[nameIdx]?.trim() : '';
            const location = locationIdx >= 0 ? row[locationIdx]?.trim() : undefined;

            const isCompleted = ['done', 'complete', 'completed', 'true', 'yes', 'x', '1'].includes(status);

            if (!isCompleted) continue;

            // Categorize by type column if available
            if (type.includes('course') || type.includes('cert')) {
                coursesCompleted++;
            } else if (type.includes('skill') || type.includes('tool')) {
                skillsLearned++;
            } else if (type.includes('milestone') || type.includes('major')) {
                milestonesCompleted++;
            } else if (type.includes('conference') || type.includes('conf') || type.includes('internship')) {
                conferences.push({
                    name: name || `Conference ${conferences.length + 1}`,
                    theme: 'forest',
                    location: location || undefined,
                });
            } else {
                tasksCompleted++;
            }
        }

        const result: SheetsResponse = {
            tasksCompleted,
            coursesCompleted,
            skillsLearned,
            milestonesCompleted,
            conferences,
        };

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(result);
    } catch (error) {
        console.error('Sheets API error:', error);
        return res.status(500).json({ error: 'Failed to fetch sheet data' });
    }
}

function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(current);
                current = '';
            } else if (char === '\n' || (char === '\r' && next === '\n')) {
                row.push(current);
                current = '';
                rows.push(row);
                row = [];
                if (char === '\r') i++;
            } else {
                current += char;
            }
        }
    }

    if (current || row.length > 0) {
        row.push(current);
        rows.push(row);
    }

    return rows;
}

function findColumnIndex(headers: string[], searchTerms: string[]): number {
    for (const term of searchTerms) {
        const idx = headers.findIndex(h => h.includes(term));
        if (idx >= 0) return idx;
    }
    return -1;
}
