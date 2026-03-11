import { useRef, useEffect, useCallback, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { VillageScene } from './game/scenes/VillageScene';
import { EventBus } from './game/EventBus';
import { loadState, saveState, shouldFetch, clearFetchCooldown } from './lib/stateManager';
import { calculateProgress, GitHubData, OrcidData, ScholarData, SheetData } from './lib/progressCalculator';

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
            let sheetData: SheetData | null = null;

            // Fetch GitHub data if username is configured
            if (state.config.githubUsername) {
                try {
                    const res = await fetch(`/api/github?username=${encodeURIComponent(state.config.githubUsername)}`);
                    if (res.ok) githubData = await res.json();
                } catch (e) {
                    console.warn('GitHub fetch failed:', e);
                }
            }

            // Fetch ORCID data if configured
            if (state.config.orcidId) {
                try {
                    const res = await fetch(`/api/orcid?orcidId=${encodeURIComponent(state.config.orcidId)}`);
                    if (res.ok) orcidData = await res.json();
                } catch (e) {
                    console.warn('ORCID fetch failed:', e);
                }
            }

            // Fetch Google Scholar data if configured
            if (state.config.googleScholarId) {
                try {
                    const res = await fetch(`/api/scholar?authorId=${encodeURIComponent(state.config.googleScholarId)}`);
                    if (res.ok) scholarData = await res.json();
                } catch (e) {
                    console.warn('Scholar fetch failed:', e);
                }
            }

            // Fetch Google Sheets data if configured
            if (state.config.sheetsSpreadsheetId) {
                try {
                    const res = await fetch(`/api/sheets?spreadsheetId=${encodeURIComponent(state.config.sheetsSpreadsheetId)}`);
                    if (res.ok) sheetData = await res.json();
                } catch (e) {
                    console.warn('Sheets fetch failed:', e);
                }
            }

            // Calculate new progress
            const newProgress = calculateProgress(githubData, orcidData, scholarData, sheetData);

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
