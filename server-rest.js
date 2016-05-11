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
        dbManager.databaseCreate(req.responder, req.dbName, req.body);
    });

    app.delete('/:dbName', function(req) {
        dbManager.databaseDrop(req.responder, req.dbName);
    });

    app.get('/:dbName', function(req) {
        dbManager.tableList(req.responder, req.dbName);
    });

    app.put('/:dbName/:tableName', function(req) {
        dbManager.tableCreate(req.responder, req.dbName, req.tableName, req.body);
    });

    app.delete('/:dbName/:tableName', function(req) {
        dbManager.tableDrop(req.responder, req.dbName, req.tableName);
    });

    app.get('/:dbName/:tableName', function(req) {
        dbManager.workerList(req.responder, req.dbName, req.tableName);
    });

    app.put('/:dbName/:tableName/:worker', function(req) {
        dbManager.workerCreate(req.responder, req.dbName, req.tableName, req.worker, req.body);
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