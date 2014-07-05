var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var ac = require('./client');

var port = 3000;

app.use(express.static(__dirname + '/public'));

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

io.of('/vcc').on('connection', function (socket) {

    socket.on('login', function (data) {
        console.log("用户登录: " + JSON.stringify(data));
        if (data.tenantId == null || data.agentId == null || data.password == null || data.ext == null) {
            socket.emit('login', {rtn: false, descr: '参数不完整'});
        } else {
            var client = ac.findClient(data.tenantId, data.agentId);
            if (client) {
                client.status(socket);
                client.sockets.push(socket);
                console.log('push ' + socket.id);
            } else {
                var params = {
                    tenantId: data.tenantId,
                    agentId: data.agentId,
                    password: data.password,
                    ext: data.ext,
                    host: '183.56.130.201'
                };
                client = new ac.Client(params);
                client.sockets.push(socket);
                console.log('push ' + socket.id);
                client.init();
                ac.clients.push(client);
            }
            socket.cconeClient = client;
        }

    });

    socket.on('dial', function (data) {
        socket.cconeClient.dial(data);
    });
    socket.on('logout', function () {
        socket.cconeClient.logout();
    });
    socket.on('transfer', function (data) {
        socket.cconeClient.transfer(data);
    });
    socket.on('consult', function (data) {
        socket.cconeClient.consult(data);
    });
    socket.on('hold', function () {
        socket.cconeClient.hold();
    });
    socket.on('unhold', function () {
        socket.cconeClient.unhold();
    });
    socket.on('consult_cancel', function () {
        socket.cconeClient.consultCancel();
    });
    socket.on('consult_bridge', function () {
        socket.cconeClient.consultBridge();
    });
    socket.on('consult_transfer', function () {
        socket.cconeClient.consultTransfer();
    });
    socket.on('ssi', function () {
        socket.cconeClient.ssi();
    });
    socket.on('end_wrapup', function () {
        socket.cconeClient.endWrapup();
    });
    socket.on('change_state', function (data) {
        socket.cconeClient.changeState(data);
    });
    socket.on('admin_mode', function (data) {
        socket.cconeClient.changeAdminMode(data);
    });
    
    socket.on('wrapup_mode', function (data) {
        socket.cconeClient.changeWrapupMode(data);
    });

    socket.on('agents_info', function(data){
        socket.cconeClient.agentsInfo(data);
    });

    socket.on('ivrs_info', function(data){
        socket.cconeClient.ivrsInfo(data);
    });

    socket.on('queues_info', function(data){
        socket.cconeClient.queuesInfo(data);
    });

    socket.on('disconnect', function () {
        if (socket.cconeClient == undefined) return;

        for (var i in socket.cconeClient.sockets) {
            if (socket == socket.cconeClient.sockets[i]) {
                socket.cconeClient.sockets.splice(i, 1);
                socket.cconeClient.countdown();
                break;
            }
        }
    });

    socket.on('error', function(e){
        console.warn(e);
    });
});




