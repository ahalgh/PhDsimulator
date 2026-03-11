import { google } from 'googleapis';

/**
 * Creates a Google JWT auth client using service account credentials.
 * Supports optional impersonation for domain-wide delegation (needed for Google Tasks).
 */
export function getGoogleAuth(impersonateEmail?: string) {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!email || !privateKey) {
        throw new Error('Google service account credentials not configured');
    }

    return new google.auth.JWT({
        email,
        key: privateKey,
        scopes: [
            'https://www.googleapis.com/auth/tasks.readonly',
            'https://www.googleapis.com/auth/calendar.readonly',
        ],
        subject: impersonateEmail || undefined,
    });
}
