import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';

interface Config {
    githubUsername: string;
    orcidId: string;
    googleScholarId: string;
    sheetsSpreadsheetId: string;
    manualMilestones: {
        qualifyingExam: boolean;
        proposalDefense: boolean;
        dissertationDefense: boolean;
    };
}

const STORAGE_KEY = 'phd-simulator-state';

export default function AdminPage() {
    const [config, setConfig] = useState<Config>({
        githubUsername: '',
        orcidId: '',
        googleScholarId: '',
        sheetsSpreadsheetId: '',
        manualMilestones: {
            qualifyingExam: false,
            proposalDefense: false,
            dissertationDefense: false,
        },
    });

    const [testResults, setTestResults] = useState<Record<string, string>>({});
    const [saved, setSaved] = useState(false);

    // Data management state
    const [importPreview, setImportPreview] = useState<any>(null);
    const [importError, setImportError] = useState('');
    const [syncing, setSyncing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load config from localStorage on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const state = JSON.parse(raw);
                if (state.config) {
                    setConfig({
                        githubUsername: state.config.githubUsername || '',
                        orcidId: state.config.orcidId || '',
                        googleScholarId: state.config.googleScholarId || '',
                        sheetsSpreadsheetId: state.config.sheetsSpreadsheetId || '',
                        manualMilestones: state.config.manualMilestones || {
                            qualifyingExam: false,
                            proposalDefense: false,
                            dissertationDefense: false,
                        },
                    });
                }
            }
        } catch { /* ignore */ }
    }, []);

    const saveConfig = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const state = raw ? JSON.parse(raw) : {};
            state.config = { ...state.config, ...config };

            // Update milestones count in village progress
            if (state.village?.buildings) {
                const milestones = config.manualMilestones;
                state.village.buildings.castle.rawCount =
                    (milestones.qualifyingExam ? 1 : 0) +
                    (milestones.proposalDefense ? 1 : 0) +
                    (milestones.dissertationDefense ? 1 : 0);
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            console.error('Failed to save config:', e);
        }
    };

    const testGitHub = async () => {
        if (!config.githubUsername) {
            setTestResults(prev => ({ ...prev, github: 'Enter a username first' }));
            return;
        }
        setTestResults(prev => ({ ...prev, github: 'Testing...' }));
        try {
            const res = await fetch(`/api/github?username=${encodeURIComponent(config.githubUsername)}`);
            if (res.ok) {
                const data = await res.json();
                setTestResults(prev => ({
                    ...prev,
                    github: `Found ${data.totalCommits} commits, ${data.totalPRsMerged} PRs, ${data.totalIssuesClosed} issues`,
                }));
            } else {
                const err = await res.json();
                setTestResults(prev => ({ ...prev, github: `Error: ${err.error}` }));
            }
        } catch {
            setTestResults(prev => ({ ...prev, github: 'Connection failed' }));
        }
    };

    const testOrcid = async () => {
        if (!config.orcidId) {
            setTestResults(prev => ({ ...prev, orcid: 'Enter an ORCID ID first' }));
            return;
        }
        setTestResults(prev => ({ ...prev, orcid: 'Testing...' }));
        try {
            const res = await fetch(`/api/orcid?orcidId=${encodeURIComponent(config.orcidId)}`);
            if (res.ok) {
                const data = await res.json();
                setTestResults(prev => ({
                    ...prev,
                    orcid: `Found ${data.totalPublications} publications, ${data.educationEntries} education entries`,
                }));
            } else {
                const err = await res.json();
                setTestResults(prev => ({ ...prev, orcid: `Error: ${err.error}` }));
            }
        } catch {
            setTestResults(prev => ({ ...prev, orcid: 'Connection failed' }));
        }
    };

    const testScholar = async () => {
        if (!config.googleScholarId) {
            setTestResults(prev => ({ ...prev, scholar: 'Enter an Author ID first' }));
            return;
        }
        setTestResults(prev => ({ ...prev, scholar: 'Testing...' }));
        try {
            const res = await fetch(`/api/scholar?authorId=${encodeURIComponent(config.googleScholarId)}`);
            if (res.ok) {
                const data = await res.json();
                setTestResults(prev => ({
                    ...prev,
                    scholar: `Found ${data.totalCitations} citations, h-index: ${data.hIndex}, i10-index: ${data.i10Index}`,
                }));
            } else {
                const err = await res.json();
                setTestResults(prev => ({ ...prev, scholar: `Error: ${err.error}` }));
            }
        } catch {
            setTestResults(prev => ({ ...prev, scholar: 'Connection failed' }));
        }
    };

    // ── Data Management functions ──

    const exportBackup = () => {
        try {
            const payload = {
                _meta: {
                    exportDate: new Date().toISOString(),
                    exportVersion: 1,
                    gameStateVersion: 2,
                    source: 'phd-simulator',
                },
                gameState: JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'),
                achievements: JSON.parse(localStorage.getItem('phd-sim-achievements') || 'null'),
                dialogueSeen: JSON.parse(localStorage.getItem('phd-sim-dialogue-seen') || 'null'),
                audioPrefs: { muted: localStorage.getItem('phd-sim-muted') === 'true' },
            };

            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `phd-simulator-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed:', e);
        }
    };

    const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        setImportError('');
        setImportPreview(null);
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);

                if (!data._meta || data._meta.source !== 'phd-simulator') {
                    setImportError('Invalid file: not a PhD Simulator backup.');
                    return;
                }
                if (data._meta.gameStateVersion > 2) {
                    setImportError(`Incompatible version: file is v${data._meta.gameStateVersion}, app supports up to v2.`);
                    return;
                }
                if (!data.gameState) {
                    setImportError('Invalid file: missing game state data.');
                    return;
                }

                setImportPreview(data);
            } catch {
                setImportError('Failed to parse file. Make sure it is valid JSON.');
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be re-selected
        event.target.value = '';
    };

    const applyImport = () => {
        if (!importPreview) return;
        try {
            if (importPreview.gameState) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(importPreview.gameState));
            }
            if (importPreview.achievements) {
                localStorage.setItem('phd-sim-achievements', JSON.stringify(importPreview.achievements));
            }
            if (importPreview.dialogueSeen) {
                localStorage.setItem('phd-sim-dialogue-seen', JSON.stringify(importPreview.dialogueSeen));
            }
            if (importPreview.audioPrefs !== undefined) {
                localStorage.setItem('phd-sim-muted', String(importPreview.audioPrefs?.muted ?? false));
            }
            setImportPreview(null);
            window.location.reload();
        } catch (e) {
            setImportError('Failed to apply import: ' + (e as Error).message);
        }
    };

    const handleSync = () => {
        setSyncing(true);
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const state = JSON.parse(raw);
                state.lastFetchTimestamp = '';
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            }
            window.location.href = '/';
        } catch (e) {
            console.error('Sync failed:', e);
            setSyncing(false);
        }
    };

    const getImportSummary = () => {
        if (!importPreview) return null;
        const gs = importPreview.gameState;
        const cfg = gs?.config;
        const achievements = importPreview.achievements;
        const meta = importPreview._meta;

        const sources: string[] = [];
        if (cfg?.githubUsername) sources.push('GitHub');
        if (cfg?.orcidId) sources.push('ORCID');
        if (cfg?.googleScholarId) sources.push('Scholar');
        if (cfg?.sheetsSpreadsheetId) sources.push('Sheets');

        return {
            exportDate: meta?.exportDate ? new Date(meta.exportDate).toLocaleString() : 'Unknown',
            sources: sources.length > 0 ? sources.join(', ') : 'None',
            achievementCount: achievements?.unlocked?.length ?? 0,
        };
    };

    const styles = {
        container: {
            maxWidth: '700px',
            margin: '0 auto',
            padding: '40px 20px',
            fontFamily: 'Arial, sans-serif',
            color: '#e0e0e0',
            backgroundColor: '#0a0a0a',
            minHeight: '100vh',
        } as const,
        title: {
            fontSize: '28px',
            color: '#FFD700',
            marginBottom: '8px',
            fontFamily: 'Georgia, serif',
        } as const,
        subtitle: {
            fontSize: '14px',
            color: '#888',
            marginBottom: '32px',
        } as const,
        section: {
            marginBottom: '28px',
            padding: '20px',
            backgroundColor: '#1a1a2e',
            borderRadius: '8px',
            border: '1px solid #2a2a4a',
        } as const,
        sectionTitle: {
            fontSize: '16px',
            color: '#FFD700',
            marginBottom: '12px',
            fontWeight: 'bold' as const,
        },
        label: {
            display: 'block',
            fontSize: '13px',
            color: '#aaa',
            marginBottom: '4px',
        } as const,
        input: {
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            backgroundColor: '#0d0d1a',
            border: '1px solid #333',
            borderRadius: '4px',
            color: '#fff',
            marginBottom: '12px',
            outline: 'none',
        } as const,
        button: {
            padding: '8px 16px',
            fontSize: '13px',
            backgroundColor: '#1a3d0a',
            color: '#FFD700',
            border: '1px solid #FFD700',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '8px',
        } as const,
        saveButton: {
            padding: '12px 32px',
            fontSize: '15px',
            backgroundColor: '#FFD700',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold' as const,
        } as const,
        testResult: {
            fontSize: '12px',
            color: '#66BB6A',
            marginTop: '6px',
        } as const,
        checkbox: {
            marginRight: '8px',
        } as const,
        checkboxLabel: {
            fontSize: '14px',
            color: '#ccc',
            display: 'block',
            marginBottom: '8px',
            cursor: 'pointer',
        } as const,
        link: {
            color: '#42A5F5',
            textDecoration: 'none',
        } as const,
    };

    return (
        <>
            <Head>
                <title>PhD Simulator - Settings</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <div style={styles.container}>
                <h1 style={styles.title}>PhD Simulator Settings</h1>
                <p style={styles.subtitle}>
                    Configure your data sources to power your village.{' '}
                    <a href="/" style={styles.link}>Back to village</a>
                </p>

                {/* GitHub */}
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>GitHub</div>
                    <label style={styles.label}>GitHub Username</label>
                    <input
                        style={styles.input}
                        type="text"
                        value={config.githubUsername}
                        onChange={e => setConfig({ ...config, githubUsername: e.target.value })}
                        placeholder="e.g., ahalgh"
                    />
                    <button style={styles.button} onClick={testGitHub}>
                        Test Connection
                    </button>
                    {testResults.github && <p style={styles.testResult}>{testResults.github}</p>}
                </div>

                {/* ORCID */}
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>ORCID</div>
                    <label style={styles.label}>ORCID ID (format: 0000-0000-0000-0000)</label>
                    <input
                        style={styles.input}
                        type="text"
                        value={config.orcidId}
                        onChange={e => setConfig({ ...config, orcidId: e.target.value })}
                        placeholder="e.g., 0000-0002-1234-5678"
                    />
                    <button style={styles.button} onClick={testOrcid}>
                        Test Connection
                    </button>
                    {testResults.orcid && <p style={styles.testResult}>{testResults.orcid}</p>}
                </div>

                {/* Google Scholar */}
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>Google Scholar</div>
                    <label style={styles.label}>
                        Google Scholar Author ID (from URL: scholar.google.com/citations?user=<b>THIS_PART</b>)
                    </label>
                    <input
                        style={styles.input}
                        type="text"
                        value={config.googleScholarId}
                        onChange={e => setConfig({ ...config, googleScholarId: e.target.value })}
                        placeholder="e.g., dkAoREEAAAAJ"
                    />
                    <button style={styles.button} onClick={testScholar}>
                        Test Connection
                    </button>
                    {testResults.scholar && <p style={styles.testResult}>{testResults.scholar}</p>}
                    <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                        Requires SERPAPI_KEY in server environment. Powers trees and reputation.
                    </p>
                </div>

                {/* Google Sheets */}
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>Google Sheets</div>
                    <label style={styles.label}>
                        Spreadsheet ID (from the URL: docs.google.com/spreadsheets/d/<b>THIS_PART</b>/edit)
                    </label>
                    <input
                        style={styles.input}
                        type="text"
                        value={config.sheetsSpreadsheetId}
                        onChange={e => setConfig({ ...config, sheetsSpreadsheetId: e.target.value })}
                        placeholder="e.g., 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                    />
                    <p style={{ fontSize: '12px', color: '#888', marginTop: '-8px' }}>
                        Your sheet must be published to web (File &gt; Share &gt; Publish to web).
                        Expected columns: Name/Task, Status (Done/Complete), Type (task/course/skill/milestone/conference).
                    </p>
                </div>

                {/* Manual Milestones */}
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>PhD Milestones (Manual)</div>
                    <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
                        Check these as you complete major milestones. Each one upgrades your Castle.
                    </p>
                    <label style={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            style={styles.checkbox}
                            checked={config.manualMilestones.qualifyingExam}
                            onChange={e => setConfig({
                                ...config,
                                manualMilestones: { ...config.manualMilestones, qualifyingExam: e.target.checked },
                            })}
                        />
                        Qualifying Exam Passed
                    </label>
                    <label style={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            style={styles.checkbox}
                            checked={config.manualMilestones.proposalDefense}
                            onChange={e => setConfig({
                                ...config,
                                manualMilestones: { ...config.manualMilestones, proposalDefense: e.target.checked },
                            })}
                        />
                        Proposal Defended
                    </label>
                    <label style={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            style={styles.checkbox}
                            checked={config.manualMilestones.dissertationDefense}
                            onChange={e => setConfig({
                                ...config,
                                manualMilestones: { ...config.manualMilestones, dissertationDefense: e.target.checked },
                            })}
                        />
                        Dissertation Defended
                    </label>
                </div>

                {/* Data Management */}
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>Data Management</div>
                    <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
                        Export your village progress as a backup, import a previous backup, or force a data refresh.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button style={styles.button} onClick={exportBackup}>
                            Export Backup
                        </button>
                        <button style={styles.button} onClick={() => fileInputRef.current?.click()}>
                            Import Backup
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={handleImportFile}
                            style={{ display: 'none' }}
                        />
                        <button
                            style={{ ...styles.button, opacity: syncing ? 0.6 : 1 }}
                            onClick={handleSync}
                            disabled={syncing}
                        >
                            {syncing ? 'Syncing...' : 'Sync Now'}
                        </button>
                    </div>

                    {importError && (
                        <p style={{ fontSize: '12px', color: '#EF5350', marginTop: '10px' }}>
                            {importError}
                        </p>
                    )}

                    {importPreview && (() => {
                        const summary = getImportSummary();
                        return (
                            <div style={{
                                marginTop: '16px',
                                padding: '14px',
                                backgroundColor: '#0d0d1a',
                                borderRadius: '6px',
                                border: '1px solid #333',
                            }}>
                                <div style={{ fontSize: '13px', color: '#FFD700', marginBottom: '10px', fontWeight: 'bold' }}>
                                    Import Preview
                                </div>
                                <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.8' }}>
                                    <div>Exported: {summary?.exportDate}</div>
                                    <div>Data sources: {summary?.sources}</div>
                                    <div>Achievements: {summary?.achievementCount} unlocked</div>
                                </div>
                                <p style={{ fontSize: '11px', color: '#FF9800', marginTop: '10px', marginBottom: '12px' }}>
                                    This will replace all current game data. Make sure to export a backup first!
                                </p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        style={{ ...styles.button, backgroundColor: '#1a3d0a', borderColor: '#FFD700' }}
                                        onClick={applyImport}
                                    >
                                        Apply Import
                                    </button>
                                    <button
                                        style={{ ...styles.button, borderColor: '#666', color: '#999' }}
                                        onClick={() => setImportPreview(null)}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Save */}
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button style={styles.saveButton} onClick={saveConfig}>
                        Save Settings
                    </button>
                    {saved && (
                        <p style={{ color: '#66BB6A', marginTop: '10px', fontSize: '14px' }}>
                            Settings saved! Refresh the village to see changes.
                        </p>
                    )}
                </div>
            </div>
        </>
    );
}
