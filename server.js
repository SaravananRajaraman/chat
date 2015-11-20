var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var morgan = require('morgan');

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(__dirname + '/access.log', {flags: 'a'});

// setup the logger
app.use(morgan('combined', {stream: accessLogStream}));

app.all('/*', function(req, res, next) {
        
    res.header("Access-Control-Allow-Origin", "*");       
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');        
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');        
    next();
});

app.get('/', function(req, res, next){  
    var ip = req.headers['x-forwarded-for'] ||  req.connection.remoteAddress || req.socket.remoteAddress ||  req.connection.socket.remoteAddress;
    console.log(ip);      
	res.sendFile(__dirname + '/');
});

app.get('/index.html', function(req, res, next){        
    console.log(req.connection.remoteAddress);      
	res.sendFile(__dirname + '/');
});

app.get('/roomSize', function(req, res, next){                
    var roomId = req.param('roomId');
    console.log(roomId);
    // http://stackoverflow.com/a/25028902/2616818
    var clients = io.sockets.adapter.rooms[roomId];         
    var numClients = (typeof clients !== 'undefined') ? Object.keys(clients).length : 0;
    var roomMember = [];
    console.log(numClients);
    for (var clientId in clients ) {        
     //this is the socket of each client in the room.
     var clientSocket = io.sockets.connected[clientId];
        //you can do whatever you need with this
        // clientSocket.emit('new event', "Updates");
        console.log(clientId);
        // console.log(clientSocket);
        roomMember.push(clientSocket.userId);
    };

    res.send({
        roomSize: numClients,
        roomMember: roomMember
    });    
});   

io.sockets.on('connection', function(socket){        
    console.log("a new connection establish @ " +socket.id);    

    socket.on('open', function(data) {
        console.log(data);
        socket.broadcast.emit('open', data);
    });


    socket.on('join', function(data) {                  
        // http://stackoverflow.com/a/25028902/2616818

        socket.join(data.roomId);
        socket.userId = data.userId;
        socket.roomId = data.roomId;

        var clients = io.sockets.adapter.rooms[data.roomId];         
        var numClients = (typeof clients !== 'undefined') ? Object.keys(clients).length : 0;

        console.log(clients); 
        console.log(numClients);

        var roomMember = [];
        for (var clientId in clients ) {
            var clientSocket = io.sockets.connected[clientId];
            roomMember.push(clientSocket.userId);
        }

        data.roomSize = numClients;
        data.roomMember = roomMember;

        // for particular user: http://stackoverflow.com/a/30888936/2616818
        io.sockets.connected[socket.id].emit('joined', data);

        // data.socketId = socket.id
        socket.broadcast.to(data.roomId).emit('joined', data);
        console.log("on Join : " + socket.id + " | userId : " +socket.userId);
    });

    socket.on('disconnect', function(data){            
        console.log("a user disconnected");                    
        console.log("disconnected : " + socket.id + " | userId : " +socket.userId);

        var obj= {
            roomId:socket.roomId,
            userId:socket.userId,
            roomMember:[]
        };
        var clients = io.sockets.adapter.rooms[obj.roomId];
        var numClients = (typeof clients !== 'undefined') ? Object.keys(clients).length : 0;

        for (var clientId in clients ) {
            var clientSocket = io.sockets.connected[clientId];
            obj.roomMember.push(clientSocket.userId);
        }

        if(numClients > 1){
            socket.broadcast.to(obj.roomId).emit('leave', obj);
        }
    });

    socket.on('chat', function(data) {     
        var clients = io.sockets.adapter.rooms[data.roomId];         
        var numClients = (typeof clients !== 'undefined') ? Object.keys(clients).length : 0;

        console.log(clients);
        console.log(numClients);
        
        data.roomSize = numClients;                           
        console.log("on Chat : " + socket.id + " | userId : " +socket.userId);
        socket.broadcast.to(data.roomId).emit('chat', data);
    });

    socket.on('leave', function(data) {
        console.log("leave : " + socket.id + " | userId : " +socket.userId);
        socket.leave(data.roomId);

        var clients = io.sockets.adapter.rooms[data.roomId];
        var numClients = (typeof clients !== 'undefined') ? Object.keys(clients).length : 0;
        var roomMember = [];
        for (var clientId in clients ) {
            var clientSocket = io.sockets.connected[clientId];
            roomMember.push(clientSocket.userId);
        }
        data.roomSize = numClients;
        data.roomMember = roomMember;

        socket.broadcast.to(data.roomId).emit('leave', data);
    });   
});


http.listen(process.env.PORT || 3110, process.env.IP || "0.0.0.0", function(){
  var addr = http.address();
  console.log("Server listening at", addr.address + ":" + addr.port);
});