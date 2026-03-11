import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { getGoogleAuth } from '../../../lib/googleAuth';

export interface CalendarResponse {
    conferences: Array<{ name: string; theme: string; location?: string }>;
    academicEventCount: number;
}

// Keywords that identify conference events
const CONFERENCE_KEYWORDS = [
    'conference', 'conf', 'symposium', 'workshop', 'summit', 'seminar',
    'neurips', 'icml', 'iclr', 'cvpr', 'eccv', 'iccv', 'aaai', 'acl', 'emnlp',
    'internship',
];

// Keywords that identify academic events (broader set — includes conferences)
const ACADEMIC_KEYWORDS = [
    ...CONFERENCE_KEYWORDS,
    'meeting', 'lecture', 'colloquium', 'defense', 'review',
    'lab meeting', 'office hours', 'thesis', 'committee', 'advising',
    'research', 'presentation', 'talk', 'class', 'course',
];

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<CalendarResponse | { error: string }>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { calendarId } = req.query;

    if (!calendarId || typeof calendarId !== 'string') {
        return res.status(400).json({ error: 'calendarId query parameter is required' });
    }

    try {
        const auth = getGoogleAuth();
        const calendarApi = google.calendar({ version: 'v3', auth });

        // Fetch events from the past 5 years
        const timeMin = new Date();
        timeMin.setFullYear(timeMin.getFullYear() - 5);

        const conferences: Array<{ name: string; theme: string; location?: string }> = [];
        const seenConferences = new Set<string>();
        let academicEventCount = 0;
        let pageToken: string | undefined;

        do {
            const eventsRes = await calendarApi.events.list({
                calendarId,
                timeMin: timeMin.toISOString(),
                timeMax: new Date().toISOString(),
                maxResults: 2500,
                singleEvents: true,
                orderBy: 'startTime',
                ...(pageToken ? { pageToken } : {}),
            });

            const events = eventsRes.data.items || [];

            for (const event of events) {
                if (event.status === 'cancelled') continue;

                const summary = (event.summary || '').toLowerCase();
                const description = (event.description || '').toLowerCase();
                const location = event.location || undefined;
                const combinedText = `${summary} ${description}`;

                // Check if it's a conference event
                const isConference = CONFERENCE_KEYWORDS.some(kw => combinedText.includes(kw));
                if (isConference) {
                    const key = summary.trim();
                    if (!seenConferences.has(key)) {
                        seenConferences.add(key);
                        conferences.push({
                            name: event.summary || `Conference ${conferences.length + 1}`,
                            theme: 'forest',
                            location,
                        });
                    }
                }

                // Check if it's an academic event (broader)
                const isAcademic = ACADEMIC_KEYWORDS.some(kw => combinedText.includes(kw));
                if (isAcademic) {
                    academicEventCount++;
                }
            }

            pageToken = eventsRes.data.nextPageToken || undefined;
        } while (pageToken);

        const result: CalendarResponse = { conferences, academicEventCount };

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(result);
    } catch (error) {
        console.error('Calendar API error:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch calendar data';
        return res.status(500).json({ error: message });
    }
}
