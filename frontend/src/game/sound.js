class SoundManager {
    constructor() {
        
        this.clickSound = new Audio('assets/sounds/click.mp3');
        this.eatSound = new Audio('assets/sounds/eat.mp3');

        // volimen
        this.clickSound.volume = 0.2; 
        this.eatSound.volume = 0.7;
    }

    playClick() {
        this.clickSound.currentTime = 0;
        this.clickSound.play().catch(e => console.log("Espera interacción del usuario para sonar"));
    }

    playEat() {
        this.eatSound.currentTime = 0;
        this.eatSound.play().catch(e => console.log("Espera interacción del usuario para sonar"));
    }
}