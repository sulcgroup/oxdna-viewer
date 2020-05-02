var fs = require('fs'), https = require('http'), { spawn } = require('child_process'), WebSocketServer = require('ws').Server;
const serverPort = 8888;
var oxDNA;
var clients = [];
//Create a http server 
var httpServer = https.createServer();
httpServer.listen(serverPort);
//Setup the Socket
var wss = new WebSocketServer({ server: httpServer });
wss.on('connection', (connection) => {
    // accept only one connetion at a time 
    if (clients.length > 0)
        return;
    // we need to know client index to remove them on 'close' event
    var index = clients.push(connection) - 1;
    console.log("--------------------------------------");
    console.log(`processes connected: ${clients.length}`);
    // user disconnected
    connection.on('close', (connection) => {
        // remove user from the list of connected clients
        clients.splice(index, 1);
        console.log("-------------------------------");
        console.log(`client ${index} id disconnected`);
        console.log(`processes connected: ${clients.length}`);
    });
    connection.on('message', (message) => {
        let { top_file, dat_file } = JSON.parse(message);
        //connection.send(JSON.stringify({
        //    dat_file: fs.readFileSync("./last_conf.dat", 'utf8')
        //}));
        fs.writeFile('simulation/conf_file.dat', dat_file, function (err) {
            if (err) {
                return console.log(err);
            }
        }, () => {
            fs.writeFile('simulation/top_file.top', top_file, function (err) {
                if (err) {
                    return console.log(err);
                }
            }, () => {
                oxDNA = spawn('oxDNA', ['./simulation/input_pre_relax']);
                oxDNA.stdout.on('data', (data) => {
                    console.log(`stdout: ${data}`);
                    connection.send(JSON.stringify({
                        dat_file: fs.readFileSync('./simulation/last_conf.dat', 'utf8')
                    }));
                });
                oxDNA.stderr.on('data', (data) => {
                    console.error(`stderr: ${data}`);
                });
                oxDNA.on('close', (code) => {
                    console.log(`child process exited with code ${code}`);
                });
            });
        });
    });
});
