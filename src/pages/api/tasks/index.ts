import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { getGoogleAuth } from '../../../lib/googleAuth';

export interface TasksResponse {
    tasksCompleted: number;
    coursesCompleted: number;
    skillsLearned: number;
    conferences: Array<{ name: string; theme: string; location?: string }>;
}

// Keywords that categorize a task list
const COURSE_KEYWORDS = ['course', 'class', 'certification', 'cert'];
const SKILL_KEYWORDS = ['skill', 'tool', 'technology', 'tech'];
const CONFERENCE_KEYWORDS = ['conference', 'travel', 'conf', 'symposium', 'summit'];

function categorizeTaskList(listName: string): 'course' | 'skill' | 'conference' | 'task' {
    const lower = listName.toLowerCase();
    if (COURSE_KEYWORDS.some(kw => lower.includes(kw))) return 'course';
    if (SKILL_KEYWORDS.some(kw => lower.includes(kw))) return 'skill';
    if (CONFERENCE_KEYWORDS.some(kw => lower.includes(kw))) return 'conference';
    return 'task';
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<TasksResponse | { error: string }>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Use impersonation for domain-wide delegation (Google Tasks requires it)
        const impersonateEmail = process.env.GOOGLE_TASKS_USER_EMAIL;
        const auth = getGoogleAuth(impersonateEmail);
        const tasksApi = google.tasks({ version: 'v1', auth });

        // 1. List all task lists
        const taskListsRes = await tasksApi.tasklists.list({ maxResults: 100 });
        const taskLists = taskListsRes.data.items || [];

        let tasksCompleted = 0;
        let coursesCompleted = 0;
        let skillsLearned = 0;
        const conferences: Array<{ name: string; theme: string; location?: string }> = [];

        // 2. For each task list, fetch completed tasks
        for (const list of taskLists) {
            if (!list.id) continue;

            const category = categorizeTaskList(list.title || '');
            let pageToken: string | undefined;

            do {
                const completedRes = await tasksApi.tasks.list({
                    tasklist: list.id,
                    showCompleted: true,
                    showHidden: true,
                    maxResults: 100,
                    ...(pageToken ? { pageToken } : {}),
                });

                const items = (completedRes.data.items || []).filter(
                    t => t.status === 'completed'
                );

                switch (category) {
                    case 'course':
                        coursesCompleted += items.length;
                        break;
                    case 'skill':
                        skillsLearned += items.length;
                        break;
                    case 'conference':
                        for (const item of items) {
                            conferences.push({
                                name: item.title || `Conference ${conferences.length + 1}`,
                                theme: 'forest',
                                location: item.notes || undefined,
                            });
                        }
                        break;
                    default:
                        tasksCompleted += items.length;
                        break;
                }

                pageToken = completedRes.data.nextPageToken || undefined;
            } while (pageToken);
        }

        const result: TasksResponse = {
            tasksCompleted,
            coursesCompleted,
            skillsLearned,
            conferences,
        };

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(result);
    } catch (error) {
        console.error('Tasks API error:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch tasks data';
        return res.status(500).json({ error: message });
    }
}
