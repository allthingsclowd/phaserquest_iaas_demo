if (screen.width > 1500) {
    //desktop laptop
    game = new Phaser.Game(980, 500, Phaser.AUTO, "game");

} else {
    //mobile device
    game = new Phaser.Game(window.innerWidth, window.innerHeight, Phaser.AUTO, "game");
}


//var game = new Phaser.Game(980, 500,
//    (navigator.userAgent.toLowerCase().indexOf('firefox') > -1 ? Phaser.CANVAS : Phaser.AUTO),
//    document.getElementById('game'),null,true,false);

game.state.add('Home',Home);
game.state.add('Game',Game);
game.state.add('K5Title',K5Title);
game.state.start('K5Title');

