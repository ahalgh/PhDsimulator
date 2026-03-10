import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { VillageScene } from './scenes/VillageScene';
import { UIScene } from './scenes/UIScene';
import { AUTO, Game } from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#1a3d0a',
    scene: [
        Boot,
        Preloader,
        VillageScene,
        UIScene,
    ],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
