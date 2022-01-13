"use strict";
/*
  HTTPS服务器只提供WebSocket连接服务，所以每个请求只返回404。
  真正的Web请求由机器上的主服务器处理。
  如果愿意，可以在这里返回真正的HTML并提供Web内容。
  这里使用 express 来指定静态文件
*/
var express = require('express'),
    app = express();
var http = require('http');
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;

app.use('/', express.static(__dirname + '/client')); //指定静态HTML文件的位置
var httpServer = http.createServer(app);

/*
  在分配给此示例的端口上启动 HTTP 服务器。
  这将很快转换为WebSocket端口。
*/
httpServer.listen(8888, function() {
  console.log("Server is listening on port 8888");
});

/*
  socket 服务器
  通过将 HTTP 服务器转换为一个 WebSocket 服务器
*/
var wsServer = new WebSocketServer({
  server: httpServer
});
if (!wsServer) {
  console.log("错误:无法创建WbeSocket服务器!");
}

/*
  房间信息结构
  {
    房间号: {
      names: [],
      ws: []
    }
  }
*/
var roomInfo = {};
// 服务器被客户端连接
wsServer.on('connection', (ws) => {
  var userInfo = {};
  // 接收客户端信息并把信息返回发送
  ws.on('message', (message) => {
    // 处理传入的数据。
    var sendToClients = true;
    var msg = JSON.parse(message);
    // 查看传入对象并根据其类型对其进行操作。传递未知的消息类型，因为它们可能用于实现客户端特性。带有“target”属性的消息仅通过该名称发送给用户。
    switch(msg.type) {
      // 加入
      case "join":
        var rid = msg.roomid;
        var uname = msg.userName;
        var wsInfo = {
          ws: ws,
          roomid: rid,
          userName: uname
        }
        if(roomInfo[rid]) {
          if(roomInfo[rid].names.indexOf(uname)==-1){
            roomInfo[rid].names.push(uname);
            roomInfo[rid].ws.push(wsInfo);
          }else{
            // 该房间用户名已存在
            var data = {
              type: 'error',
              roomid: msg.roomid,
              msg: '用户名已存在！'
            };
            wsServer.sendToOne(ws, data);
            return false;
          }
        }else{
          roomInfo[rid] = {
            names: [uname],
            ws: [wsInfo]
          }
        }
        // 加入成功
        userInfo = {
          roomid: rid,
          userName: uname
        };
        // 用户加入
        console.log(`${rid}房间加入新用户${uname}`);
        console.log(roomInfo);
        var msgString = {
          type: 'joined',
          roomid: rid,
          userList: roomInfo[rid].names,
          userName: uname
        };
        wsServer.broadcast(msgString);
        // 我们已经发出了正确的回应
        sendToClients = false;
        break;
    }
    /*
      转发消息给所有用户
      这允许客户端不受阻碍地交换信令和其他控制对象。
    */
    if (sendToClients) {
      // send 方法的第二个参数是一个错误回调函数
      wsServer.broadcast(msg);
    }
  });
  // 处理WebSocket“关闭”事件;这意味着用户已注销或已断开连接。
  ws.on('close', function(reason, description) {
    if(userInfo.userName){
      var roomid = userInfo.roomid,
        userName = userInfo.userName;
      // 首先，从连接列表中删除连接。
      roomInfo[roomid].ws = roomInfo[roomid].ws.filter(v=>v.userName!==userName);
      roomInfo[roomid].names = roomInfo[roomid].names.filter(v=>v!== userName);
      // 用户退出
      console.log(`通知房间${roomid}的用户${userName}退出！`);
      console.log(roomInfo);
      wsServer.broadcast({
        type: "disconnected",
        roomid: roomid,
        account: userName
      });
    }
  });
});
wsServer.broadcast = function (data) {
  var roomid = data.roomid;
  var msgString = JSON.stringify(data);
  roomInfo[roomid].ws.forEach(function(client) {
    client.ws.send(msgString);
  });
};
// 提示自己
wsServer.sendToOne = function(client, data) {
  var msgString = JSON.stringify(data);
  client.send(msgString);
};