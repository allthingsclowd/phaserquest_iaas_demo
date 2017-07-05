

var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);
var mongo = require('mongodb').MongoClient;
var quickselect = require('quickselect'); // Used to compute the median for latency

var mapFormat = require('./js/server/format.js');
var gs = require('./js/server/GameServer.js').GameServer;
// For the binary protocol of update packets :
var CoDec = require('./js/CoDec.js').CoDec;
var Encoder = require('./js/server/Encoder.js').Encoder;

// added for cloud foundry
var cfenv = require('cfenv');// Cloud Foundry Environment Variables
var appEnv = cfenv.getAppEnv();// Grab environment variables

server.enableBinary = true;
gs.server = server;



/********************************
Local Environment Variables
 ********************************/

if(appEnv.isLocal){
    require('dotenv').load();// Loads .env file into environment
}

app.use('/css',express.static(__dirname + '/css'));
app.use('/js',express.static(__dirname + '/js'));
app.use('/assets',express.static(__dirname + '/assets'));


app.get('/',function(req,res){
    res.sendFile(__dirname+'/index.html');
});

// Manage command line arguments
var myArgs = require('optimist').argv;
var mongoHost, mongoDBName;

console.log('myargs 1st --- ' + myArgs.mongoServer);

function sleep(milliseconds) {
    console.log('Waiting for database - start: ' + new Date().getTime());
    var start = new Date().getTime();
    while (true) {
        if ((new Date().getTime() - start) > milliseconds){
            break;
        }
    }
    console.log('Waiting for database - finished: ' + (new Date().getTime() - start));
}

if(myArgs.waitForDatabase) {
    sleep(myArgs.waitForDatabase);
}

// if(myArgs.heroku){ // --heroku flag to behave according to Heroku's specs
//     mongoHost = 'heroku_4tv68zls:'+myArgs.pass+'@ds141368.mlab.com:41368';
//     mongoDBName = 'heroku_4tv68zls';
// }else {
//     var mongoPort = (myArgs.mongoPort || 27017);
//     var mongoServer = (myArgs.mongoServer || 'localhost');
//     mongoHost = mongoServer+':'+mongoPort;
//     mongoDBName = 'phaserQuest';
// }



server.listen(myArgs.p || process.env.PORT || 8081,function(){ // -p flag to specify port ; the env variable is needed for Heroku
    console.log('Listening on '+server.address().port);
    server.clientUpdateRate = 1000/5; // Rate at which update packets are sent
    gs.readMap();
    server.setUpdateLoop();

    /********************************
     MongoDB Connection
     ********************************/

    //Detects environment and connects to appropriate DB
    if(appEnv.isLocal){
       // var mongoPort = (myArgs.mongoPort || 27017);
       // var mongoServer = (myArgs.mongoServer || 'localhost');
       console.log('myargs --- ' + myArgs.mongodbServer);
       var mongobdPort = (myArgs.mongodbPort || 27017);
       var mongodbServer = (myArgs.mongodbServer || 'localhost');
       var mongodbName = (myArgs.mongodbName || 'phaserQuest');
       var mongodbUser = (myArgs.mongodbUser || 'phaser');
       var mongodbPassword = (myArgs.mongodbPassword || 'phas3r');
       mongodbHost = mongodbServer+':'+mongoPort;

       if ((mongodbUser == '') || (mongodbPassword == '')){
           mongoURL = 'mongodb://'+mongoHost+'/'+mongoDBName;
       } else {
           mongoURL = 'mongodb://'+mongodbUser+':'+mongodbPassword+'@'+mongoHost+'/'+mongoDBName;       

       }
       mongo.connect(mongoURL,function(err,db){
            if(err) throw(err);
            server.db = db;
            console.log('Connection to db established');
        });
        console.log('Your MongoDB is running at ' + mongoURL);
    }
    // Connect to MongoDB Service on K5 IaaS/PaaS
    else if(!appEnv.isLocal) {
        console.log('CF ENV VARS - ', JSON.parse(process.env.VCAP_SERVICES));
        console.log('CF URI - ', (JSON.parse(process.env.VCAP_SERVICES)['user-provided'][0]['credentials']['uri']));
        var env = JSON.parse(process.env.VCAP_SERVICES),
            mongoURL = env['user-provided'][0]['credentials']['uri'];
        mongo.connect(mongoURL,function(err,db){
            if(err) throw(err);
            server.db = db;
            console.log('Connection to db established');
        });        
        console.log('Your MongoDB is running at ' + mongoURL);
    }
    else{
        console.log('Unable to connect to MongoDB.');
    }

    // mongo.connect('mongodb://'+mongoHost+'/'+mongoDBName,function(err,db){
    //     if(err) throw(err);
    //     server.db = db;
    //     console.log('Connection to db established');
    // });
});

io.on('connection',function(socket){
    console.log('connection with ID '+socket.id);
    console.log(server.getNbConnected()+' already connected');
    socket.pings = [];

    socket.on('ponq',function(sentStamp){
        // Compute a running estimate of the latency of a client each time an interaction takes place between client and server
        // The running estimate is the median of the last 20 sampled values
        var ss = server.getShortStamp();
        var delta = (ss - sentStamp)/2;
        if(delta < 0) delta = 0;
        socket.pings.push(delta); // socket.pings is the list of the 20 last latencies
        if(socket.pings.length > 20) socket.pings.shift(); // keep the size down to 20
        socket.latency = server.quickMedian(socket.pings.slice(0)); // quickMedian used the quickselect algorithm to compute the median of a list of values
    });

    socket.on('init-world',function(data){
        if(!gs.mapReady) {
            socket.emit('wait');
            return;
        }
        if(data.new) {
            if(!gs.checkSocketID(socket.id)) return;
            gs.addNewPlayer(socket,data);
        }else{
            if(!gs.checkPlayerID(data.id)) return;
            gs.loadPlayer(socket,data.id);
        }
    });

    socket.on('revive',function(){
        gs.revivePlayer(gs.getPlayerID(socket.id));
    });

    socket.on('path',function(data){
        if(!gs.handlePath(data.path,data.action,data.or,socket)) socket.emit('reset',gs.getCurrentPosition(socket.id));
    });

    socket.on('chat',function(txt){
        if(!txt.length || txt.length > 300) return;
        var rooms = gs.listAOIsFromSocket(socket.id);
        var playerID = gs.getPlayerID(socket.id);
        rooms.forEach(function(room){
            socket.broadcast.to(room).emit('chat', {id:playerID,txt:txt});
        });
    });

    socket.on('delete',function(data){
        gs.deletePlayer(data.id);
    });

    socket.on('disconnect',function(){
        console.log('Disconnection with ID '+socket.id);
        if(gs.getPlayer(socket.id)) gs.removePlayer(socket.id);
    });
});

server.setUpdateLoop = function(){
    setInterval(gs.updatePlayers,server.clientUpdateRate);
};

server.sendInitializationPacket = function(socket,packet){
    packet = server.addStamp(packet);
    if(server.enableBinary) packet = Encoder.encode(packet,CoDec.initializationSchema);
    socket.emit('init',packet);
};

server.sendUpdate = function(socketID,pkg){
    pkg = server.addStamp(pkg);
    try{
        pkg.latency = Math.floor(server.getSocket(socketID).latency);
    }catch(e){
        console.log(e);
        pkg.latency = 0;
    }
    if(server.enableBinary) pkg = Encoder.encode(pkg,CoDec.finalUpdateSchema);
    if(pkg) io.in(socketID).emit('update',pkg);
};

server.getNbConnected =function(){
    return Object.keys(gs.players).length;
};

server.addToRoom = function(socketID,room){
    var socket = server.getSocket(socketID);
    socket.join(room);
};

server.leaveRoom = function(socketID,room){
    var socket = server.getSocket(socketID);
    if(socket) socket.leave(room);
};

server.sendID = function(socket,playerID){
    socket.emit('pid',playerID);
};

server.sendError = function(socket){
    socket.emit('dbError');
};

server.addStamp = function(pkg){
    pkg.stamp = server.getShortStamp();
    return pkg;
};

server.getShortStamp = function(){
    return parseInt(Date.now().toString().substr(-9));
};

server.getSocket = function(id){
    return io.sockets.connected[id]; // won't work if the socket is subscribed to a namespace, because the namsepace will be part of the id
};

server.quickMedian = function(arr){ // Compute the median of an array using the quickselect algorithm
    var  l = arr.length;
    var n = (l%2 == 0 ? (l/2)-1 : (l-1)/2);
    quickselect(arr,n);
    return arr[n];
};