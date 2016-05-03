// nodejs base
var os = require("os");
var fs = require("fs");
var util = require('util');
var path = require('path');
var url = require("url");

// requires npm install
var express = require('express');
var uuid = require('node-uuid');
var bodyParser = require('body-parser');

exports.start = function(port, dbManager) {
    var app = express();
    app.listen(port, function() {
        console.log("ldb running at http://localhost:" + port + "/\n");
    });

    app.use(bodyParser.json()); // for parsing application/json
    app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

    app.use(function(req, res, next) {
        // cross origin
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-timeout-in-sec");
        res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");

        // no cache
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');

        // response manager
        req.responder = require('./responder.js').responder(res);

        next();
    });

    app.use('/', function(req, res, next) {
        if (req.method == "OPTIONS") { // deals with firefox
            res.json('verb not supported')
            return; /* breaks the chain: do not call next() */
        }

        var decodedUri = url.parse(decodeURI(req.originalUrl));
        if (decodedUri.query) {
            var queryArgs = decodedUri.query.split('&');
            req.cmd = queryArgs[0];
            req.params = queryArgs.slice(1);
        }
        next();
    });

    app.use('/:dbName', function(req, res, next) {
        req.dbName = req.params.dbName;
        next();
    });

    app.use('/:dbName/:tableName', function(req, res, next) {
        req.tableName = req.params.tableName;
        next();
    });

    app.use('/:dbName/:tableName/:worker', function(req, res, next) {
        req.worker = req.params.worker;
        next();
    });

    app.get('/', function(req) {
        dbManager.databaseList(req.responder);
    });

    app.put('/', function(req) {
        if (req.cmd === 'clearCache')
            dbManager.clearCache(req.responder);
        else
            req.responder.error({ status: 405, message: 'invalid command: ' + req.cmd });
    });

    app.put('/:dbName', function(req) {
        dbManager.databaseCreate(req.responder, req.dbName);
    });

    app.delete('/:dbName', function(req) {
        dbManager.databaseDrop(req.responder, req.dbName);
    });

    app.get('/:dbName', function(req) {
        dbManager.tableList(req.responder, req.dbName);
    });

    app.put('/:dbName/:tableName', function(req) {
        dbManager.tableCreate(req.responder, req.dbName, req.tableName);
    });

    app.delete('/:dbName/:tableName', function(req) {
        dbManager.tableDrop(req.responder, req.dbName, req.tableName);
    });

    app.get('/:dbName/:tableName', function(req) {
        dbManager.workerList(req.responder, req.dbName, req.tableName);
    });

    app.put('/:dbName/:tableName/:worker', function(req) {
        var definition = {};
        definition.type = req.query.type;
        dbManager.workerCreate(req.responder, req.dbName, req.tableName, req.worker, definition);
    });

    app.delete('/:dbName/:tableName/:worker', function(req) {
        dbManager.workerDrop(req.responder, req.dbName, req.tableName, req.worker);
    });

    // LAST FUNCTIONS - global error handler ( else would not be invoked )
    app.use('*', function(req, res) {
        res.status(404).json('bad route: ' + req.originalUrl);
        res.end();
    });

    app.use(function(err, req, res, next) {
        req.responder.error(err);
    });


    /*
      
        app.use('/:id*', function(req, res, next) {
            // browserId middleware: 
            // 1. gets and stores: browserId and its associated socket, 
            // 2. creates the socketData object, 
            // 3. stores res object to be later used by (ie responded) the websocket server
            // 4. ensure that the browser socket exists
     
            if (req.method == "OPTIONS") { // deals with firefox
                res.json('verb not supported')
                return; // breaks the chain: do not call next()
            }
     
            req.browserId = req.params.id;
            req.socket = shared.socketsByBrowser[req.browserId];
     
            var socketData = req.body; // this will copy any extra field into the socket data - including body.value
            req.socketData = socketData;
            socketData.requestId = uuid.v1();
            shared.pendingRequests[socketData.requestId] = res;
     
            socketData.params = [];
            var decodedUri = url.parse(decodeURI(req.originalUrl));
            if (decodedUri.query) {
                var queryArgs = decodedUri.query.split('&');
                socketData.cmd = queryArgs[0];
                socketData.params = queryArgs.slice(1);
            }
     
            var isBrowserCreation = req.method === 'PUT' && (!req.params[0]);
            if (!isBrowserCreation) {
                // then browser needs to exist with a connected socket
                var message;
                if (!req.socket)
                    message = "Browser not found: " + req.browserId;;
     
                if (req.socket && !req.socket.connected)
                    message = "Browser disconnected: " + req.browserId;
     
                if (message) {
                    handleRequestError(req, 404, message);
                    return;
                }
            }
     
            next();
        });
     
        app.put('/:id', function(req) {
            // creates a new browser instance
            if (os.platform() != 'win32') {
                // If you are using Google Chrome on Linux, update the command with the following first:
                // google-chrome  --disable-web-security            
                var message = "not supported OS: " + os.platform()
                handleRequestError(req, 500, message);
                return;
            }
     
            if (req.query.type !== 'chrome') {
                var message = "unsupported browser type: " + req.query.type;
                handleRequestError(req, 415, message);
                return;
            }
     
            if (shared.socketsByBrowser[req.browserId]) {
                var message = "browser " + req.browserId + " already running";
                handleRequestError(req, 409, message);
                return;
            }
     
            var sessionDataPath = browserUserDataFolder + req.browserId;
            var chromeExtensionPath = path.resolve(__dirname, 'chrome_extension');
     
            var spawn = childProcess.spawn;
            var baseUrl = 'http://localhost:' + port + '/';
            var startupArgs = ["--no-default-browser-check", "--no-first-run", "--test-type", "--ignore-certificate-errors", "--disable-popup-blocking", "--extensions-on-chrome-urls",
                "--user-data-dir=" + sessionDataPath, "--load-extension=" + chromeExtensionPath,
                "--user-agent='Chrome 43.|" + req.browserId + "|" + req.socketData.requestId + "|" + baseUrl + "|Chrome 43.'", // hack: pass startup param in useragent for easy retrieval from the extension
                'about:blank'];
     
            if (req.query.maximized && req.query.maximized === "1")
                startupArgs.unshift("--start-maximized");
     
            var browser = spawn(browserPath, startupArgs);
     
            console.log('[' + req.browserId + '] starting...');
        });
     
        app.delete('/:id', function(req) {
            // kills browser instance
            var socketData = req.socketData;
            socketData.cmd = "kill";
     
            logCommand(req.browserId, socketData);
            req.socket.emit('cmd', socketData);
     
            delete shared.socketsByBrowser[req.browserId];
        });
     
        app.use('/:id/url', function(req) {
            // gets/sets the browser's url
            var socketData = req.socketData;
     
            switch (req.method) {
                case "GET": socketData.cmd = "get_url"; break;
                case "PUT": socketData.cmd = "set_url"; break;
            }
     
            logCommand(req.browserId, socketData);
            req.socket.emit('cmd', socketData);
        });
     
        app.use('/:id/tabs', function(req) {
            // gets/sets the browser's url
            var socketData = req.socketData;
     
            if (!socketData.cmd)
                socketData.cmd = "get_tabs_info";
     
            logCommand(req.browserId, socketData);
            req.socket.emit('cmd', socketData);
        });
     
        app.use('/:id/page*', function(req) {
            // interacts with the browser's html page
            var timeOutInSeconds = req.headers["x-timeout-in-sec"];
            var expiry = new Date();
            if (timeOutInSeconds)
                expiry.setTime(expiry.getTime() + timeOutInSeconds * 1000);
     
            var socketData = req.socketData;
            socketData.requestExpiry = expiry.toString();
     
            var decodedUri = url.parse(decodeURI(req.originalUrl));
     
            if (req.params[0])
                socketData.path = decodedUri.pathname.substring(decodedUri.pathname.indexOf(req.params[0]));
            else
                socketData.path = '';
     
            if (!socketData.cmd)
                socketData.cmd = 'get'; // default value if nothing passed
     
            logCommand(req.browserId, socketData);
            req.socket.emit('cmd', socketData);
        });
        
        */

    function logCommand(browserId, socketData) {
        var logEntryText = '[' + browserId + '] ' + socketData.cmd;

        if (socketData.path !== undefined)
            logEntryText += ' ' + socketData.path;

        if (socketData.value !== undefined)
            logEntryText += ' { ' + util.inspect(socketData.value) + ' }';

        console.log(logEntryText);
    }

    function handleRequestError(req, code, message) {
        console.log("[" + code + "]", message, "\n");

        var res = shared.pendingRequests[req.socketData.requestId];
        res.status(code).json(message);
        delete shared.pendingRequests[req.socketData.requestId];
    }

    function rmdirSync(dir, file) {
        var p = file ? path.join(dir, file) : dir;

        if (fs.lstatSync(p).isDirectory()) {
            fs.readdirSync(p).forEach(rmdirSync.bind(null, p));
            fs.rmdirSync(p);
        }

        else fs.unlinkSync(p);
    }

    function dumpObjectToDisk(obj, filename) {
        var toString = util.inspect(obj, false, null);
        fs.writeFile(filename, toString, function(err) {
            if (err) {
                return console.log(err);
            }
            console.log("dumpObjectToDisk to '" + filename + "' completed");
        });
    }
};