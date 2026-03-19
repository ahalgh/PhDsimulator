import { useRef, useEffect, useCallback, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { VillageScene } from './game/scenes/VillageScene';
import { EventBus } from './game/EventBus';
import { loadState, saveState, shouldFetch, clearFetchCooldown } from './lib/stateManager';
import { calculateProgress, GitHubData, OrcidData, ScholarData, TasksData, CalendarData } from './lib/progressCalculator';
import { apiUrl, hasBackend } from './lib/apiClient';
import { fetchGitHubDirect, fetchOrcidDirect } from './lib/dataSources';

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sceneName, setSceneName] = useState('');

    const currentScene = (scene: Phaser.Scene) => {
        setSceneName(scene.scene.key);
        if (scene.scene.key === 'VillageScene') {
            setIsLoading(false);
        }
    };

    // Reusable fetch function — called on mount and on 'refresh-data' event
    const fetchAndUpdate = useCallback(async () => {
        const state = loadState();

        if (!shouldFetch(state)) return;

        try {
            let githubData: GitHubData | null = null;
            let orcidData: OrcidData | null = null;
            let scholarData: ScholarData | null = null;
            let tasksData: TasksData | null = null;
            let calendarData: CalendarData | null = null;

            // Fetch GitHub data — direct call (public API, works on static hosts)
            // Falls back to backend route only when a backend URL is configured (adds GraphQL + token)
            if (state.config.githubUsername) {
                try {
                    if (hasBackend()) {
                        const res = await fetch(apiUrl(`/api/github?username=${encodeURIComponent(state.config.githubUsername)}`));
                        if (res.ok) githubData = await res.json();
                    } else {
                        githubData = await fetchGitHubDirect(state.config.githubUsername);
                    }
                } catch (e) {
                    console.warn('GitHub fetch failed:', e);
                }
            }

            // Fetch ORCID data — direct call (fully public API, CORS supported)
            if (state.config.orcidId) {
                try {
                    if (hasBackend()) {
                        const res = await fetch(apiUrl(`/api/orcid?orcidId=${encodeURIComponent(state.config.orcidId)}`));
                        if (res.ok) orcidData = await res.json();
                    } else {
                        orcidData = await fetchOrcidDirect(state.config.orcidId);
                    }
                } catch (e) {
                    console.warn('ORCID fetch failed:', e);
                }
            }

            // Fetch Google Scholar data if configured
            if (state.config.googleScholarId) {
                try {
                    const res = await fetch(apiUrl(`/api/scholar?authorId=${encodeURIComponent(state.config.googleScholarId)}`));
                    if (res.ok) scholarData = await res.json();
                } catch (e) {
                    console.warn('Scholar fetch failed:', e);
                }
            }

            // Fetch Google Tasks data if enabled
            if (state.config.googleTasksEnabled) {
                try {
                    const res = await fetch(apiUrl('/api/tasks'));
                    if (res.ok) tasksData = await res.json();
                } catch (e) {
                    console.warn('Tasks fetch failed:', e);
                }
            }

            // Fetch Google Calendar data if configured
            if (state.config.googleCalendarId) {
                try {
                    const res = await fetch(apiUrl(`/api/calendar?calendarId=${encodeURIComponent(state.config.googleCalendarId)}`));
                    if (res.ok) calendarData = await res.json();
                } catch (e) {
                    console.warn('Calendar fetch failed:', e);
                }
            }

            // Calculate new progress
            const milestones =
                (state.config.manualMilestones.qualifyingExam ? 1 : 0) +
                (state.config.manualMilestones.proposalDefense ? 1 : 0) +
                (state.config.manualMilestones.dissertationDefense ? 1 : 0);
            const newProgress = calculateProgress(githubData, orcidData, scholarData, tasksData, calendarData, milestones);

            // Save state with new progress
            state.previousVillage = state.village;
            state.village = newProgress;
            state.lastFetchTimestamp = new Date().toISOString();
            saveState(state);

            // Update game if scene is ready
            if (phaserRef.current?.scene) {
                const villageScene = phaserRef.current.scene as VillageScene;
                if (villageScene.updateVillage) {
                    villageScene.updateVillage(newProgress);
                }
            }
        } catch (e) {
            console.error('Data fetch error:', e);
        }
    }, []);

    // Fetch on mount
    useEffect(() => {
        fetchAndUpdate();
    }, [fetchAndUpdate]);

    // Listen for force-refresh from in-game sync button
    useEffect(() => {
        const handleRefresh = () => {
            clearFetchCooldown();
            fetchAndUpdate();
        };
        EventBus.on('refresh-data', handleRefresh);
        return () => { EventBus.off('refresh-data', handleRefresh); };
    }, [fetchAndUpdate]);

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
        </div>
    );
}

export default App;
