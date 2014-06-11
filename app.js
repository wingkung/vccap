var net = require('net');
var ac = require('./client');
var io = require('socket.io')(3000);

io.of('/vcc').on('connection', function (socket) {
    socket.on('login', function(data){
        console.log("用户登录:[" + data.tenantId + '-' + data.agentId + "]" + io.transports[socket.id].name );
        var client = ac.findClient(data.tenantId, data.agentId);
        if (client){
            client.status(socket);
            client.sockets.push(socket);
            console.log('push ' + socket.id);
        }else{
            var params = {
                tenantId: data.tenantId,
                agentId: data.agentId,
                password: data.password,
                ext: data.ext,
                host: '183.56.130.201'
            };
            client = new ac.Client(params, function(err){});
            client.sockets.push(socket);
            console.log('push ' + socket.id);
            client.init();
            ac.clients.push(client);
        }
        socket.cconeClient = client;
    });

    socket.on('dial', function(data){
        socket.cconeClient.dial(data);
    });
    socket.on('logout', function(){
        socket.cconeClient.logout();
    });
    socket.on('transfer', function(data){
        socket.cconeClient.transfer(data);
    });
    socket.on('consult', function(data){
        socket.cconeClient.consult(data);
    });
    socket.on('hold', function(){
        socket.cconeClient.hold();
    });
    socket.on('unhold', function(){
        socket.cconeClient.unhold();
    });
    socket.on('consult_cancel', function(){
        socket.cconeClient.consultCancel();
    });
    socket.on('consult_bridge', function(){
        socket.cconeClient.consultBridge();
    });
    socket.on('consult_transfer', function(){
        socket.cconeClient.consultTransfer();
    });
    socket.on('ssi', function(){
        socket.cconeClient.ssi();
    });
    socket.on('end_wrapup', function(){
        socket.cconeClient.endWrapup();
    });
    socket.on('change_state', function(data){
        socket.cconeClient.changeState(data);
    });
    socket.on('admin_mode', function(data){
        socket.cconeClient.changeAdminMode(data);
    });
    socket.on('wrapup_mode', function(data){
        socket.cconeClient.changeWrapupMode(data);
    });

    socket.on('disconnect', function(){
        for (var i in socket.cconeClient.sockets){
            if (socket == socket.cconeClient.sockets[i]){
                socket.cconeClient.sockets.splice(i, 1);
                socket.cconeClient.countdown();
                break;
            }
        }
    })
});




