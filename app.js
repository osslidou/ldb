const APP_PORT = 8081;
const CONFIG_FILE_PATH = ".config";

var dbManager = require('./db-manager.js').dbManager;
var restServer = require('./server-rest.js');

dbManager.init(CONFIG_FILE_PATH);
restServer.start(APP_PORT, dbManager);

process.on('uncaughtException', function(err) {
    console.log('process.on(uncaughtException): ' + err + '\n');
});











