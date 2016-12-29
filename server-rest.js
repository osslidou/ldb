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

exports.start = function (port, dbManager) {
    var app = express();
    app.listen(port, function () {
        console.log("ldb running at http://localhost:" + port + "/\n");
    });

    app.use(bodyParser.json()); // for parsing application/json
    app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

    app.use(function (req, res, next) {
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

    app.use('/', function (req, res, next) {
        if (req.method == "OPTIONS") { // deals with firefox
            res.json('verb not supported')
            return; /* breaks the chain: do not call next() */
        }
        next();
    });

    app.use('/', function (req, res, next) {
        // for data paths
        var isSchemaPath = req.url.startsWith('/schema');
        if (!isSchemaPath) {
            var decodedUri = url.parse(decodeURI(req.originalUrl));
            if (decodedUri.query) {
                console.log('query:', decodedUri.query)
                var queryArgs = decodedUri.query.split('&');
                console.log('queryArgs:', queryArgs);
                req.cmd = queryArgs[0];
            }            
        }
        next();
    });

    /// ********************** SCHEMA
    app.use('/schema/:dbName', function (req, res, next) {
        req.dbName = req.params.dbName;
        next();
    });

    app.use('/schema/:dbName/:tableName', function (req, res, next) {
        req.tableName = req.params.tableName;
        next();
    });

    app.get('/schema', function (req) {
        dbManager.databaseList(req.responder);
    });

    app.put('/schema/:dbName', function (req) {
        dbManager.databaseCreate(req.responder, req.dbName, req.body);
    });

    app.delete('/schema/:dbName', function (req) {
        dbManager.databaseDrop(req.responder, req.dbName);
    });

    app.get('/schema/:dbName', function (req) {
        dbManager.databaseInfo(req.responder, req.dbName);
    });

    app.put('/schema/:dbName/:tableName', function (req) {
        dbManager.tableCreate(req.responder, req.dbName, req.tableName, req.body);
    });

    app.delete('/schema/:dbName/:tableName', function (req) {
        dbManager.tableDrop(req.responder, req.dbName, req.tableName);
    });

    app.put('/', function (req) {
        if (req.cmd === 'clearCache')
            dbManager.clearCache(req.responder);
        else
            req.responder.error({ status: 405, message: 'invalid database command: ' + req.cmd });
    });

    /// ********************** DATA
    app.get('/:dbName/:tableName', function (req) {
        var dbName = req.params.dbName;
        var tableName = req.params.tableName;

        dbManager.getData(req.responder, dbName, tableName);
    });


    // LAST FUNCTIONS - global error handler ( else would not be invoked )
    app.use('*', function (req, res) {
        res.status(404).json('bad route: ' + req.originalUrl);
        res.end();
    });

    app.use(function (err, req, res, next) {
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
        fs.writeFile(filename, toString, function (err) {
            if (err) {
                return console.log(err);
            }
            console.log("dumpObjectToDisk to '" + filename + "' completed");
        });
    }
};