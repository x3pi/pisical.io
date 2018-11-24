
// ===== Động cơ vật lý ===== //
var Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Composites = Matter.Composites,
    MouseConstraint = Matter.MouseConstraint,
    Mouse = Matter.Mouse,
    World = Matter.World,
    Bodies = Matter.Bodies;

//  Tạo engine
var engine = Engine.create(),
    world = engine.world;



// Tạo runner
var runner = Runner.create();
Runner.run(runner, engine);

// Thêm stack fluid
var stack = Composites.stack(100, 185, 10, 10, 20, 0, function (x, y) {
    return Bodies.circle(x, y, 20);
});

World.add(world, [
    // Tường
    Bodies.rectangle(400, 0, 800, 50, { isStatic: true }),
    Bodies.rectangle(400, 600, 800, 50, { isStatic: true }),
    Bodies.rectangle(800, 300, 50, 600, { isStatic: true }),
    Bodies.rectangle(0, 300, 50, 600, { isStatic: true }),
    stack
]);

//======= Phần này để vẽ ========//


// ================Tạo bối cảnh cho canvas================= //
var canvas = document.getElementById("my_Canvas");
var gl = canvas.getContext('webgl');

/*===== Các thông số =====*/
var NUM_METABALLS = stack.bodies.length;
var WIDTH = canvas.width;
var HEIGHT = canvas.height;


// ==========Định nghĩa đỉnh cho hình học======= //

// Tạo 4 đỉnh chúng ta sẽ vẽ hình chữ nhật bằng hai hình tam giác
// 
//
//   A---C
//   |  /|
//   | / |
//   |/  |
//   B---D
//
// 
// gl.TRIANGLE_STRIP, chúng ta sẽ vẽ tam giác ABC và BCD.
var vertexData = new Float32Array([
    -1.0, 1.0, // top left
    -1.0, -1.0, // bottom left
    1.0, 1.0, // top right
    1.0, -1.0, // bottom right
]);
var vertexDataBuffer = gl.createBuffer(); // Tạo bộ đệm
gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer); // Chọn kiểu dữ liệu
gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW); // Liên kết dữ liệu vào bộ đệm



/**
 * Shaders
 */

// Biên dịch shader nếu có lỗi báo lỗi
function compileShader(shaderSource, shaderType) {
    var shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
    }

    return shader;
}

var vertexShader = compileShader(`
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }`, gl.VERTEX_SHADER);

var fragmentShader = compileShader(`
    precision highp float;
    uniform vec3 metaballs[` + NUM_METABALLS + `];
    const float WIDTH = ` + WIDTH +`.0;
    const float HEIGHT = ` + HEIGHT + `.0;

    void main(){
        float x = gl_FragCoord.x;
        float y = gl_FragCoord.y;
        float v = 0.0;
        for (int i = 0; i < ` + NUM_METABALLS + `; i++) {
            vec3 mb = metaballs[i];
            float dx = mb.x - x;
            float dy = mb.y - y;
            float r = mb.z;
            v += r*r/(dx*dx + dy*dy);
        }
        if (v > 1.0) {
            gl_FragColor = vec4(x/WIDTH, y/HEIGHT, 0.0, 1.0);
        } else {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        }
    }`, gl.FRAGMENT_SHADER);

var program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);


/**
 * Thiết lập attributes
 */

// Tiện ích báo lỗi nếu không tìm thấy attributes

function getAttribLocation(program, name) {
    var attributeLocation = gl.getAttribLocation(program, name);
    if (attributeLocation === -1) {
        throw 'Can not find attribute ' + name + '.';
    }
    return attributeLocation;
}

// Thiết lập bố cục cho dữ liệu đỉnh
var positionHandle = getAttribLocation(program, 'position');
gl.enableVertexAttribArray(positionHandle);
gl.vertexAttribPointer(positionHandle,
    2, // position là vec2
    gl.FLOAT, // mỗi thành phần là một float
    gl.FALSE, // không normalize giá trị
    2 * 4, // 2 thành phần 4 byte float
    0 // bù vào từng khoảng dữ liệu đỉnh
);


/**
 * Thiết lập Uniform
 */

// Tiện ích báo lỗi nếu chúng ta không tìm thấy đồng phục
function getUniformLocation(program, name) {
    var uniformLocation = gl.getUniformLocation(program, name);
    if (uniformLocation === -1) {
        throw 'Can not find uniform ' + name + '.';
    }
    return uniformLocation;
}
var metaballsHandle = getUniformLocation(program, 'metaballs');



// ======= Xử lý các sự kiện socket.io ======== //

var socket = io();
socket.on('limitEvent', function (data) { alert(data.ms) });


socket.on('broadcast', function (data) {
    var dataToSendToGPU = new Float32Array(3 * NUM_METABALLS);

    for (var i = 0; i < NUM_METABALLS; i++) {
        var baseIndex = 3 * i;
        var mb = data.data[i];
        Matter.Body.translate(stack.bodies[i], { x: mb.x - stack.bodies[i].position.x, y: mb.y - stack.bodies[i].position.y });
        dataToSendToGPU[baseIndex + 0] = mb.x;
        dataToSendToGPU[baseIndex + 1] = HEIGHT - mb.y;
        dataToSendToGPU[baseIndex + 2] = 15;
    }


    gl.uniform3fv(metaballsHandle, dataToSendToGPU);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);


});





// ========== Điều khiển bằng mouse  ========= //
var mouse = Mouse.create(canvas),
    mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.98,
            render: {
                visible: false
            }
        }
    });
var mouseData = {}
Matter.Events.on(mouseConstraint, 'startdrag', function (event) {
    canvas.onmousemove = function (event) { myFunction(event) };
    mouseData.id = event.body.id;
    mouseData.type = event.body.type;
});

Matter.Events.on(mouseConstraint, 'enddrag', function (event) {
    canvas.onmousemove = null;
});




function myFunction(e) {

    var x = e.clientX;
    var y = e.clientY;
    var coor = "Coordinates: (" + x + "," + y + ")";
    socket.emit('clientEvent', { x: x, y: y, id: mouseData.id, type: mouseData.type });

}
World.add(world, mouseConstraint);






