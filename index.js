
const Matter = require('matter-js');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;



var clients = 0;
var LIMIT = 10;
app.use(express.static(__dirname + '/public'));

// ==== Động cơ vật lý === //

var Engine = Matter.Engine,
    Composites = Matter.Composites,
    MouseConstraint = Matter.MouseConstraint,
    Mouse = Matter.Mouse,
    World = Matter.World,
    Bodies = Matter.Bodies;

// Tạo engine
var engine = Engine.create(),
    world = engine.world;




// Stack fluid
var stack = Composites.stack(100, 185, 10, 10, 20, 0, function (x, y) {
    return Bodies.circle(x, y, 15);
});

World.add(world, [
    // Tường
    Bodies.rectangle(400, 0, 800, 50, { isStatic: true }),
    Bodies.rectangle(400, 600, 800, 50, { isStatic: true }),
    Bodies.rectangle(800, 300, 50, 600, { isStatic: true }),
    Bodies.rectangle(0, 300, 50, 600, { isStatic: true }),
    stack
]);

// ==== Vòng lặp của môt phỏng ==== //

setInterval(function () {
    Engine.update(engine, 1000 / 60);

    var data = []
    for (var i = 0; i < stack.bodies.length; i++) {
        var baseIndex = 3 * i;
        var mb = stack.bodies[i].position;
        data[i] = mb;

    }
    io.sockets.emit('broadcast', { data: data });

}, 1000 / 60);
var com = Matter.Composite.get(stack, 10, 'body');
Matter.Body.scale(com, 5, 5);



// ==== Xử lý sự kiện socket.io ==== //

io.on('connection', function (socket) {
    clients++;

    if (clients > LIMIT) { socket.emit('limitEvent', { ms: 'Lượng truy cập nhiều chỉ có thể xem và không tương tác được.' }); }
    if (clients <= LIMIT) {
    socket.on('clientEvent', function (data) {
            Matter.Body.translate(com, { x: data.x - com.position.x, y: data.y - com.position.y });
        
    });
    }
    socket.on('disconnect', function () {
        clients--;
    });
});



http.listen(port, () => console.log('listening on port ' + port));
