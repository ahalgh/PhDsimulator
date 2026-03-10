import { useRef, useEffect, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { VillageScene } from './game/scenes/VillageScene';
import { loadState, saveState, shouldFetch } from './lib/stateManager';
import { calculateProgress, GitHubData, SheetData } from './lib/progressCalculator';

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

    // Fetch data from APIs on mount
    useEffect(() => {
        const fetchData = async () => {
            const state = loadState();

            if (!shouldFetch(state)) return;

            try {
                let githubData: GitHubData | null = null;
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
                const newProgress = calculateProgress(githubData, null, null, sheetData);

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
        };

        fetchData();
    }, []);

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
        </div>
    );
}

export default App;
