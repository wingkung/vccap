/* client.js */

var net = require('net');

var clients = exports.clients = [];
exports.Client = function (params) {
    this.tenantId = params.tenantId;
    this.agentId = params.agentId;
    this.password = params.password;
    this.ext = params.ext;
    this.host = params.host;
    this.sockets = [];

    this.left = "";
    this.timer = null;

    var self = this;

    this.send = function (action, msg) {
        console.log(action + ',' + self.tenantId + ',' + self.agentId + ',' + msg);
        self.netSocket.write(action + ',' + self.tenantId + ',' + self.agentId + ',' + msg + '\r\n');
    };
    this.init = function () {
        self.netSocket = net.connect({port: 14601, host: self.host}, function () {
            var md5 = require('crypto').createHash('md5');
            md5.update(self.password);
            self.send('Login', md5.digest("hex") + ',' + self.ext + ',N');
            console.log(self.tenantId + '-' + self.agentId + ":客户端连接建立");
        });
        self.netSocket.on('data', function (data) {
            //console.log(self.tenantId + '-' + self.agentId + ":接收 " + data.toString());
            data = self.left + data;
            self.left = "";

            var i = data.indexOf("\r\n");
            var s = "";
            while (i > 0){
                s = data.substr(0, i);
                self.handle(s.trim());
                data = data.substr(i+2);
                i = data.indexOf("\r\n");
            }
            self.left = data;
        });
        self.netSocket.on('error', function (err) {
            console.log(self.tenantId + '-' + self.agentId + ":客户端连接异常" + err);
            self.broadcast(self.sockets, 'neterror', {descr: '连接中断'});
            self.destroy();
        });
        self.netSocket.on('end', function () {
            console.log(self.tenantId + '-' + self.agentId + ":客户端连接断开 (" + self.sockets.length + ")");
            self.broadcast(self.sockets, 'end', {descr: '连接断开'});
            self.destroy();
        });
    };

    this.handle = function (data) {
        console.log(self.tenantId + '-' + self.agentId + ':net接收 ' + data);
        var args = data.split(',');
        if (args[0] == 'Login') {
            if (args[1] == "1") {
                self.broadcast(self.sockets, 'login', {rtn: true, descr: '登录成功'});
                self.onScene({scene: "0", ctls: "9216"});

                clearInterval(self.timer);
                self.timer = setInterval(function () {
                    self.netSocket.write('KeepAlive,' + self.tenantId + "," + self.agentId + "\r\n");
                }, 3000)
            } else {
                self.broadcast(self.sockets, 'login', {rtn: false, descr: '登录失败'});
                self.destroy();
            }
        } else if (args[0] == 'Dial') {
            if (args[1] == "1") {
                self.broadcast(self.sockets, 'dial', {rtn: true, descr: '呼叫成功'})
            } else {
                self.broadcast(self.sockets, 'dial', {rtn: true, descr: '呼叫失败'})
            }
        } else if (args[0] == 'AgentState') {
            self.state = args[1];
            self.stateDescr = translateState(self.state);
            if (args.length > 2) {
                self.subState = args[2];
            }
            self.broadcast(self.sockets, 'state', {state: self.state, subState: self.subState, stateDescr: self.stateDescr })
        } else if (args[0] == "InitAgent") {
            console.log(args);
            for (var i in args) {
                if (i == 0) continue;
                if (args.hasOwnProperty(i)) {
                    var kv = args[i].split('=');
                    if (kv[0] == 'agentname') {
                        self.agentName = kv[1];
                    } else if (kv[0] == 'typecode') {
                        self.typeCode = kv[1];
                    } else if (kv[0] == 'wrapupmode') {
                        self.wrapupMode = kv[1];
                    } else if (kv[0] == 'adminmode') {
                        self.adminMode = kv[1];
                    }
                }
            }
            self.broadcast(self.sockets, 'info', {agentName: self.agentName, agentId: self.agentId, ext: self.ext,
                typeCode: self.typeCode, wrapupMode: self.wrapupMode, adminMode: self.adminMode})
        } else if (args[0] == "Scene") {
            self.onScene({scene: args[1], ctls: args[2]});
        } else if (args[0] == "Hangup") {
            self.onScene({scene: 0, ctls: 9216});
        } else if (args[0] == "Logout"){
            if (args[1] == 1){
                self.broadcast(self.sockets, 'logout', {descr: '登出成功'});
            }else{
                self.broadcast(self.sockets, 'logout', {descr: '登出失败'});
            }
        } else if (args[0] == "AgentsInfo"){
            self.onAgentsInfo(args[1]);
        } else if (args[0] == "ServicesInfo"){
            self.onIvrsInfo(args[1]);
        } else if (args[0] == 'SkillGroupsInfo'){
            self.onQueuesInfo(args[1]);
        } else if (args[0] == "Dial"){
            var rtn = (args[1] == "1");
            var descr = "呼叫" + (rtn ? "成功" : "失败");
            self.broadcast(self.sockets, 'dial', {rtn:rtn, descr: descr});
        }else if (args[0] == "Hold"){
            var rtn = args[1] == "1";
            var descr = "保持" + (rtn ? "成功" : "失败");
            self.broadcast(self.sockets, 'hold', {rtn:rtn, descr: descr});
        }else if (args[0] == "UnHold"){
            var rtn = args[1] == "1";
            var descr = "取消" + (rtn ? "成功" : "失败");
            self.broadcast(self.sockets, 'unhold', {rtn:rtn, descr: descr});
        }else if (args[0] == "Consult"){
            var rtn = args[1] == "1";
            var descr = "咨询" + (rtn ? "成功" : "失败");
            self.broadcast(self.sockets, 'consult', {rtn:rtn, descr: descr});
        } else if (args[0] == "ConsultCancel"){
            var rtn = args[1] == "1";
            var descr = "取消" + (rtn ? "成功" : "失败");
            self.broadcast(self.sockets, 'consult_cancel', {rtn:rtn, descr: descr});
        }else if (args[0] == "ConsultTransfer"){
            var rtn = args[1] == "1";
            var descr = "转移" + (rtn ? "成功" : "失败");
            self.broadcast(self.sockets, 'consult_transfer', {rtn:rtn, descr: descr});
        }else if (args[0] == "ConsultBridge"){
            var rtn = args[1] == "1";
            var descr = "三方" + (rtn ? "成功" : "失败");
            self.broadcast(self.sockets, 'consult_bridge', {rtn:rtn, descr: descr});
        }else if (args[0] == "Transfer"){
            var rtn = args[1] == "1";
            var descr = "转移" + (rtn ? "成功" : "失败");
            self.broadcast(self.sockets, 'transfer', {rtn:rtn, descr: descr});
        }else if(args[0] == "UserIn"){
            var data = {};
            for (var i in args) {
                if (i == 0) continue;
                if (args.hasOwnProperty(i)) {
                    var kv = args[i].split('=');
                    if (kv[0] == 'Caller') {
                        data.caller = kv[1];
                    } else if (kv[0] == 'Callee') {
                        var arr = kv[1].split('#');
                        data.callee = arr[0];
                        data.sessionId = arr[1];
                        data.sessionType = arr[2];
                    }
                }
            }
            self.broadcast(self.sockets, 'userin', data);
        }
    };

    this.onQueuesInfo = function(info){
        if (self.lastQueuesInfoTime == null){
            self.lastQueuesInfoTime = new Date().getTime();
        }
        if (self.queues == null || new Date().getTime() - self.lastQueuesInfoTime > 60000){
            self.queues = [];
            var arr = info.split('&');
            for (var i in arr){
                var line = arr[i];
                var arr1 = line.split(':');
                var queue = {queueId: arr1[0], name: arr1[1]};
                self.queues.push(queue);
            }
        }
        self.broadcast(self.sockets, 'queues_info', self.queues);
    };

    this.onIvrsInfo = function(info){
        if (self.lastIvrsInfoTime == null){
            self.lastIvrsInfoTime = new Date().getTime();
        }
        if (self.ivrs == null || new Date().getTime() - self.lastIvrsInfoTime > 60000){
            self.ivrs = [];
            var arr = info.split('&');
            for (var i in arr){
                var line = arr[i];
                var arr1 = line.split(':');
                var ivr = {ivrId: arr1[0], name: arr1[1]};
                self.ivrs.push(ivr);
            }
        }
        self.broadcast(self.sockets, 'ivrs_info', self.ivrs);
    };

    this.onAgentsInfo = function(info){
        if (self.lastAgentsInfoTime == null){
            self.lastAgentsInfoTime = new Date().getTime();
        }
        if (self.agents == null || new Date().getTime() - self.lastAgentsInfoTime > 3000){
            self.agents = [];
            var arr = info.split('&');
            for (var i in arr){
                var line = arr[i];
                var arr1 = line.split(':');
                var agent = {agentId: arr1[0], state:arr1[1], stateDescr: translateState(arr1[1]), name: arr1[2], ext: arr1[3]};
                self.agents.push(agent);
            }
        }
        self.broadcast(self.sockets, 'agents_info', self.agents);
    };

    this.onScene = function (data) {
        self.scene = data.scene;
        self.ctls = data.ctls;
        self.broadcast(self.sockets, 'scene', {scene: self.scene, ctls: self.ctls})
    };

    this.status = function (socket) {
        var descr = translateState(self.state);
        this.emit(socket, 'login', {rtn: true, descr: '登录成功'});
        this.emit(socket, 'status', {agentName: self.agentName, agentId: self.agentId, typeCode: self.typeCode, ext: self.ext,
            state: self.state, subState: self.subState, stateDescr: descr, wrapupMode: self.wrapupMode, adminMode: self.adminMode,
            scene: self.scene, ctls: self.ctls});
    };

    this.dial = function (data) {
        console.log(self.tenantId + '-' + self.agentId + ":呼叫 [" + data.type + "-" + data.target + "]");
        self.send('Dial', data.type + "," + data.target + "," + data.code400 + "-" + data.code);
    };

    this.logout = function () {
        console.log(self.tenantId + '-' + self.agentId + ":登出");
        self.send('Logout', '');
    };
    this.transfer = function (data) {
        console.log(self.tenantId + '-' + self.agentId + ":转移 [" + data.type + "-" + data.target + "]");
        self.send('Transfer', data.type + ',' + data.target);
    };
    this.consult = function (data) {
        console.log(self.tenantId + '-' + self.agentId + ":咨询 [" + data.type + "-" + data.target + "]");
        self.send('Consult', data.type + ',' + data.target);
    };
    this.hold = function () {
        console.log(self.tenantId + '-' + self.agentId + ":保持");
        self.send('Hold', '');
    };
    this.unhold = function () {
        console.log(self.tenantId + '-' + self.agentId + ":取消保持");
        self.send('UnHold', '');
    };
    this.consultCancel = function () {
        console.log(self.tenantId + '-' + self.agentId + ":取消咨询");
        self.send('ConsultCancel', '');
    };

    this.consultBridge = function () {
        console.log(self.tenantId + '-' + self.agentId + ":咨询三方");
        self.send('ConsultBridge', '');
    };
    this.consultTransfer = function () {
        console.log(self.tenantId + '-' + self.agentId + ":咨询转移");
        self.send('ConsultTransfer', '');
    };
    this.ssi = function () {
        console.log(self.tenantId + '-' + self.agentId + ":保持");
        self.send('Transfer', '3,99');
    };
    this.changeState = function (data) {
        self.send('ChangeState', data.state);
    };
    this.endWrapup = function () {
        self.send('ChangeState', 0);
    };
    this.changeWrapupMode = function (data) {
        self.send('WrapupMode', data.mode);
    };

    this.changeAdminMode = function (data) {
        self.send('AdminMode', data.mode);
    };

    this.agentsInfo = function(data){
        self.send('AgentsInfo', '');
    };
    this.ivrsInfo = function(data){
        self.send('ServicesInfo', '');
    };
    this.queuesInfo = function(data){
        self.send('SkillGroupsInfo', '');
    };

    this.destroy = function () {
        console.log(self.tenantId + '-' + self.agentId + ":销毁");
        removeClient(self.tenantId, self.agentId);
        clearInterval(self.timer);
    };

    this.broadcast = function (sockets, action, data) {
        console.log(self.tenantId + '-' + self.agentId + ':发送 (' + action + ')' + JSON.stringify(data));
        for (var i in sockets) {
            if (!sockets.hasOwnProperty(i)) continue;
            var socket = sockets[i];
            socket.emit(action, data);
        }
    };

    this.emit = function(socket, action, data){
        console.log(self.tenantId + '-' + self.agentId + ':发送 (' + action + ')' + JSON.stringify(data));
        socket.emit(action, data);
    };

    this.countdown = function () {
        if (self.sockets.length <= 0) {
            console.log(self.tenantId + '-' + self.agentId + ':无客户端倒计时开始');
            clearTimeout(self.cdTimer);
            self.cdTimer = setTimeout(function () {
                if (self.sockets.length <= 0) {
                    self.logout();
                }
            }, 300000);
        }
    }
};

function translateState(state) {
    if (state == 1) {
        return "空闲"
    } else if (state == 2) {
        return "忙"
    } else if (state == 3) {
        return "连接中"
    } else if (state == 4) {
        return "话后"
    } else if (state == 5) {
        return "通话中"
    } else if (state == 6) {
        return "外拨空闲"
    } else {
        return "未登录"
    }
}

exports.findClient = function (tenantId, agentId) {
    for (var i in clients) {
        if (!clients.hasOwnProperty(i)) continue;
        var client = clients[i];
        if (tenantId == client.tenantId && agentId == client.agentId) {
            return client;
        }
    }
    return null;
};

exports.findSClient = function (socket) {
    for (var i in clients) {
        if (!clients.hasOwnProperty(i)) continue;
        var client = clients[i];
        for (var j in client.sockets) {
            if (!client.sockets.hasOwnProperty(j)) continue;
            if (socket == client.sockets[j]) {
                return client;
            }
        }
    }
    return null;
};

var removeClient = exports.removeClient = function (tenantId, agentId) {
    for (var i in clients) {
        if (!clients.hasOwnProperty(i)) continue;
        var client = clients[i];
        if (tenantId == client.tenantId && agentId == client.agentId) {
            clients.splice(i, 1);
            break;
        }
    }
};

