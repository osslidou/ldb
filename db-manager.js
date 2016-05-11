var fs = require("fs");
var all_dbs; // map[dbName, db]
var path = require('path');
var app_config;
var dbManager = function() { };
var appConfigFilePath;
exports.dbManager = new dbManager();

var DEFAULT_ROOT_CONFIG = { "db_root": "data" };

dbManager.prototype.init = function(configFilePath) {
    appConfigFilePath = configFilePath;
    all_dbs = {};
    app_config = DEFAULT_ROOT_CONFIG;

    try {
        var content = fs.readFileSync(appConfigFilePath);
        app_config = JSON.parse(content);
    }
    catch (e) {
        if (e.code === 'ENOENT')
            // write default config when no previous config found
            fs.writeFileSync(configFilePath, JSON.stringify(app_config));
        else
            throw e;
    }

    ensureFolderExistsSync(app_config.db_root);
    initAllDbsSync(app_config.db_root);
}

function initAllDbsSync(db_root) {
    getDirectories(db_root).forEach(function(entry) {
        initSingleDbSync(entry);
    });
}

function initSingleDbSync(dbPath) {
    initSingleItem(dbPath, function(dbName, db) {
        all_dbs[dbName] = db;

        getDirectories(dbPath).forEach(function(entry) {
            initSingleTableSync(db, entry)
        });

        console.log(dbName + ' initialized.');
    });
}

function initSingleTableSync(db, tablePath) {
    initSingleItem(tablePath, function(tableName, table) {
        db[tableName] = table;

        getDirectories(tablePath).forEach(function(entry) {
            initSingleWorkerSync(table, entry)
        });
    });
}

function initSingleWorkerSync(table, workerPath) {
    initSingleItem(workerPath, function(workerName, worker) {
        table[workerName] = worker;
    });
}

function initSingleItem(itemPath, success) {
    var configFile = path.resolve(itemPath, ".config");
    var itemName = path.basename(itemPath);
    try {

        var textContents = fs.readFileSync(configFile);
        var item = JSON.parse(textContents);
        success(itemName, item);
    } catch (err) {
        console.log('ERROR: Unable to open the file ' + configFile);
    }
}

function getDirectories(parentPath) {
    var retVal = [];

    fs.readdirSync(parentPath).filter(function(file) { return fs.statSync(path.join(parentPath, file)).isDirectory(); }
    ).forEach(function(dirName) {
        retVal.push(path.join(parentPath, dirName));
    });

    return retVal;
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

dbManager.prototype.databaseCreate = function(responder, dbName, configuration) {
    throwIfDbExists(dbName);

    var folderPath = path.join(app_config.db_root, dbName);
    ensureFolderExistsSync(folderPath);

    var db = configuration;

    var dbConfigFile = path.resolve(folderPath, ".config");
    fs.writeFile(dbConfigFile, JSON.stringify(db), (err) => {

        console.log('file written:' + dbConfigFile);

        if (err)
            return responder.error({ message: err.message });

        all_dbs[dbName] = db;
        responder.success();
    });
}

dbManager.prototype.databaseDrop = function(responder, dbName) {
    throwIfDbNotExists(dbName);
    var folderPath = path.join(app_config.db_root, dbName);

    delete all_dbs[dbName];
    rmdirSync(folderPath);
    responder.success();
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

dbManager.prototype.tableCreate = function(responder, dbName, tableName, configuration) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];
    throwIfTableExists(db, tableName);

    var table = configuration;
    db[tableName] = table;

    var folderPath = path.join(app_config.db_root, dbName, tableName);
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
    var folderPath = path.join(app_config.db_root, dbName, tableName);
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

dbManager.prototype.workerCreate = function(responder, dbName, tableName, workerName, configuration) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];
    throwIfTableNotExists(db, tableName);

    var table = db[tableName];
    throwIfWorkerExists(db, table, workerName);

    var worker = configuration;
    table[workerName] = worker;

    var folderPath = path.join(app_config.db_root, dbName, tableName, workerName);
    ensureFolderExistsSync(folderPath);
    var configFile = path.resolve(folderPath, ".config");
    fs.writeFile(configFile, JSON.stringify(worker), (err) => {
        if (err)
            return responder.error({ message: err.message });

        responder.success();
    });
}

dbManager.prototype.workerDrop = function(responder, dbName, tableName, workerName) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];
    throwIfTableNotExists(db, tableName);
    var table = db[tableName];
    throwIfWorkeNotExists(db, table, workerName);

    delete table[workerName];
    var folderPath = path.join(app_config.db_root, dbName, tableName, workerName);
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

function throwIfWorkerExists(db, table, name) {
    if (table.hasOwnProperty(name))
        throw ({ status: 409, message: 'Worker ' + name + ' already exists' });
}

function throwIfWorkeNotExists(db, table, name) {
    if (!table.hasOwnProperty(name))
        throw ({ status: 404, message: 'Worker ' + name + ' not found' });
}

function ensureFolderExistsSync(localFolderPath) {
    //console.log('ensureFolderExists: ' + localFolderPath);

    var mkdirSync = function(basePath) {
        try {
            fs.mkdirSync(basePath);
        } catch (e) {
            if (e.code != 'EEXIST')
                throw e;
        }
    }

    var parts = localFolderPath.split(path.sep);
    for (var i = 1; i <= parts.length; i++) {
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
