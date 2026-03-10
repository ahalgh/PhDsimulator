import { Scene } from 'phaser';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // Boot scene — no assets needed, preloader handles everything
    }

    create() {
        this.scene.start('Preloader');
    }
}
