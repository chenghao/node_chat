var http = require("http");
var redis = require("socket.io-redis");
var express = require('express');
var exp = express();
var server = http.createServer(exp);

const PORT = 3000;
const HOST = 'localhost';

server.listen(parseInt(process.argv[2]) || PORT, HOST);
var io = require("socket.io").listen(server);

var clients = {};

const sub = require('redis').createClient(6379, 'localhost');
const pub = require('redis').createClient(6379, 'localhost');
io.adapter(redis({pubClient: pub, subClient: sub}));


//1 on 1 聊天后获取
sub.on('message', function (channel, msg) {
    msg = JSON.parse(msg);

    var userid = channel;
    var socket = clients[userid];

    socket.emit('msg', msg);
});

io.sockets.on("connection", function (socket) {
    //登录
    socket.on("login", function (data) {
        var userId = data.myUserId; //用户ID
        socket.myUserId = userId;

        sub.subscribe(userId); // 订阅chat频道

        clients[userId] = socket;

        console.log(userId + ' the user login');
    });

    //断开连接
    socket.on('disconnect', function () {
        userId = socket.myUserId;
        if (userId != undefined) {
            sub.unsubscribe(userId); //取消消息订阅  
            delete clients[userId]; //删除全局对象
        }
        console.log(userId + ' the user logout');
    });

    //1 on 1 (data = {toWho:"", msg:"", fromWho:""})
    socket.on("chat", function (data) {
        var userId = data.fromWho; //发送人
        if (!clients[userId]) {
            console.log('1 on 1 fromWho user not login...');
            return true;
        }
        var targetUserId = data.toWho; //接收人
        if (clients[targetUserId]) { //用户在线
            data = JSON.stringify(data);
            pub.publish(targetUserId, data); //发布消息到用户频道
        } else {
            //缓存用户数据
            console.log('1 on 1 toWho user not login');
        }
    });

    //群聊 (data = {groupId:"", msg:""})
    socket.on("groupchat", function (data) {
        data.userId = socket.myUserId;

        console.log(data.userId + ' sending group chat message');

        io.sockets.in(data.groupId).emit("groupchat", data);
    });

    //加群 (data = {groupId:"", userId:""})
    socket.on("addgroup", function (data) {
        var groupId = data.groupId;
        var userId = data.userId;

        socket.join(groupId);

        console.log(userId + ' the user add group ' + groupId);
    });

    //退群 (data = {groupId:"", userId:""})
    socket.on("logoutgroup", function (data) {
        var groupId = data.groupId;
        var userId = data.userId;

        socket.leave(groupId);

        console.log(userId + ' the user logout group ' + groupId);
    });

})