var fs = require("fs");
var all_dbs; // map[dbName, db]
var path = require('path');
var dbManager = function() { };
var appConfigFilePath;
exports.dbManager = new dbManager();

var DEFAULT_CONFIG = { "paths": [] }; // [c:\dev\db_1, c:\dev\db_2]
var DEFAULT_DB = {};

dbManager.prototype.init = function(configFilePath) {
    appConfigFilePath = configFilePath;
    try {
        all_dbs = {};

        var content = fs.readFileSync(appConfigFilePath);
        var app_config = JSON.parse(content);
        app_config.paths.forEach(function(entry) {
            console.log('init: ', entry);
            initSingleDbSync(entry);
        });
    }
    catch (e) {
        console.log("-- ERROR:\n", e);
        // create empty file        
        fs.writeFile(appConfigFilePath, JSON.stringify(DEFAULT_CONFIG));
    }
}

function initSingleDbSync(dbPath) {
    var dbConfigFile = path.resolve(dbPath, ".config");
    var dbName = path.basename(dbPath);    
    try {
        var contents = fs.readFileSync(dbConfigFile);
        var db = JSON.parse(contents);

        // add to global all_dbs map
        all_dbs[dbName] = db;
    } catch (err) {
        console.log('ERROR: Unable to open the file ' + dbConfigFile);
    }
}

dbManager.prototype.clearCache = function(responder) {
    this.init(appConfigFilePath);
    responder.success();
}

//-------------- Database
dbManager.prototype.databaseList = function(responder) {
    var dbs = [];
    Object.keys(all_dbs).forEach(function(item, key) {
        dbs.push(item);
    });
    responder.success(dbs);
}

dbManager.prototype.databaseCreate = function(responder, dbName, options) {
    throwIfDbExists(dbName);

    addOrRemoveDatabaseFromAppConfigFile(dbName, true, function(err, folderPath) {
        if (err)
            return responder.error({ message: err.message });

        var dbConfigFile = path.resolve(folderPath, ".config");
        fs.writeFile(dbConfigFile, JSON.stringify(DEFAULT_DB), (err) => {
            if (err)
                return responder.error({ message: err.message });

            all_dbs[dbName] = {};
            responder.success();
        });
    });
}

dbManager.prototype.databaseDrop = function(responder, dbName) {
    throwIfDbNotExists(dbName);

    addOrRemoveDatabaseFromAppConfigFile(dbName, false, function(err, folderPath) {
        if (err)
            return responder.error({ message: err.message });

        delete all_dbs[dbName];
        rmdirSync(folderPath);
        responder.success();
    })
}

function addOrRemoveDatabaseFromAppConfigFile(dbName, isAdd, callback) {
    var folderPath = path.join('dbs', dbName);
    ensureFolderExistsSync(folderPath);

    fs.readFile(appConfigFilePath, (err, data) => {
        if (err)
            return callback(err);

        var app_config = JSON.parse(data);

        if (isAdd) {
            app_config.paths.push(folderPath);
        } else {
            // delete
            var index = app_config.paths.indexOf(folderPath);
            if (index !== -1)
                app_config.paths.splice(index, 1);
        }

        fs.writeFile(appConfigFilePath, JSON.stringify(app_config), (err) => {
            if (err)
                return callback(err);

            callback(null, folderPath);
        });
    });
}

//-------------- Table
dbManager.prototype.tableList = function(responder, dbName) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];

    var tables = [];
    Object.keys(db).forEach(function(item, key) {
        tables.push(item);
    });
    responder.success(tables);
}

dbManager.prototype.tableCreate = function(responder, dbName, tableName, options) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];
    throwIfTableExists(db, tableName);

    var table = {};
    db[tableName] = table;

    var folderPath = path.join('dbs', dbName, tableName);
    ensureFolderExistsSync(folderPath);
    var configFile = path.resolve(folderPath, ".config");
    fs.writeFile(configFile, JSON.stringify(table), (err) => {
        if (err)
            return responder.error({ message: err.message });

        responder.success();
    });
}

dbManager.prototype.tableDrop = function(responder, dbName, tableName) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];
    throwIfTableNotExists(db, tableName);

    delete db[tableName];
    var folderPath = path.join('dbs', dbName, tableName);
    rmdirSync(folderPath);
    responder.success();
}

//-------------- Worker
dbManager.prototype.workerList = function(responder, dbName, tableName) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];

    throwIfTableNotExists(db, tableName);
    var table = db[tableName];

    var workers = [];
    Object.keys(table).forEach(function(item, key) {
        workers.push(item);
    });
    responder.success(workers);
}

dbManager.prototype.workerCreate = function(responder, dbName, tableName, workerName, definition) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];
    throwIfTableNotExists(db, tableName);

    var table = {};
    db[tableName] = table;

    var folderPath = path.join('dbs', dbName, tableName);
    ensureFolderExistsSync(folderPath);
    var configFile = path.resolve(folderPath, ".config");
    fs.writeFile(configFile, JSON.stringify(table), (err) => {
        if (err)
            return responder.error({ message: err.message });

        responder.success();
    });
}

dbManager.prototype.workerDrop = function(responder, dbName, tableName, workerName) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];
    throwIfTableNotExists(db, tableName);

    delete db[tableName];
    var folderPath = path.join('dbs', dbName, tableName);
    rmdirSync(folderPath);
    responder.success();
}


/*
 app.get('/', function (req, res) {
     // returns array of dbs
     var result = [];
     for (var key in all_dbs)
         result.push(key);
 
     res.send(result);
 });
 
 app.put('/:id', function (req) {
     // create a new db
 
     if (all_dbs[req.id]) {
         var message = "db " + req.id + " already exists\n";
         console.log(message);
 
         return;
     }
 
     console.log('db [' + req.browserId + '] created');
 });
 */

function throwIfDbExists(name) {
    if (all_dbs.hasOwnProperty(name))
        throw ({ status: 409, message: 'Database ' + name + ' already exists' });
}


function throwIfDbNotExists(name) {
    if (!all_dbs.hasOwnProperty(name))
        throw ({ status: 404, message: 'Database ' + name + ' not found' });
}

function throwIfTableExists(db, name) {
    if (db.hasOwnProperty(name))
        throw ({ status: 409, message: 'Table ' + name + ' already exists' });
}

function throwIfTableNotExists(db, name) {
    if (!db.hasOwnProperty(name))
        throw ({ status: 404, message: 'Table ' + name + ' not found' });
}

function ensureFolderExistsSync(localFolderPath) {
    var mkdirSync = function(basePath) {
        try {
            fs.mkdirSync(basePath);
        } catch (e) {
            if (e.code != 'EEXIST')
                throw e;
        }
    }

    var parts = localFolderPath.split(path.sep);
    for (var i = 2; i <= parts.length; i++) {
        var basePath = path.join.apply(null, parts.slice(0, i));
        mkdirSync(basePath);
    }
}

function rmdirSync(dir, file) {
    var p = file ? path.join(dir, file) : dir;
    if (fs.lstatSync(p).isDirectory()) {
        fs.readdirSync(p).forEach(rmdirSync.bind(null, p));
        fs.rmdirSync(p);
    }
    else
        fs.unlinkSync(p);
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
