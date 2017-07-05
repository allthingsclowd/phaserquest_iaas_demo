var K5Title = {

    preload: function () {

        game.load.spritesheet("buttons", "/assets/sprites/buttons.png", 265, 75);
        game.load.spritesheet("fjlogo", "/assets/sprites/fjlogo.png", 241, 122);
        game.load.spritesheet("dragon", "/assets/sprites/dragon.png", 120, 85, 4);
        
    },

    create: function () {
        this.companyBranding = game.add.sprite(game.world.centerX, game.world.centerY -50, "fjlogo");
        this.companyBranding.anchor.set(0.5, 0.5);

        this.buttonStart = game.add.button(game.world.centerX, game.world.centerY + 200, "buttons", this.startGame, this, 6, 7, 6);
        this.buttonStart.anchor.set(0.5, 0.5);

        //dragon
        this.dragon = game.add.sprite(game.world.centerX, game.world.centerY + 100, "dragon");
        this.dragon.anchor.set(0.5, 0.5);
        this.dragon.animations.add('fly', [0, 1, 2, 3], 12, true);
        this.dragon.animations.play('fly');
        game.stage.backgroundColor = "#26C9FF";

        this.titleSubText = game.add.text(game.world.centerX, 60, "Coming Soon", {
            font: "40px Lobster"
            , fill: "#ff0000"
            , stroke: "#222222"
            , strokeThickness: 2
            , align: "center"
        });
        this.titleSubText.anchor.set(0.5, 0.5);

        this.titleText = game.add.text(game.world.centerX, 100, "K5-Live on Tour", {
            font: "50px Lobster"
            , fill: "#000000"
            , stroke: "#222222"
            , strokeThickness: 4
            , align: "center"
        });
        this.titleText.anchor.set(0.5, 0.5);
    }
    , startGame: function () {
        game.state.start("Home");
    }
    , update: function () {

    }

}