var fs = require("fs");
var all_dbs; // map[dbName, db]
var path = require('path');
var app_config;
var dbManager = function () { };
var appConfigFilePath;
exports.dbManager = new dbManager();

var DEFAULT_ROOT_CONFIG = { "db_root": "data" };

dbManager.prototype.initialize = function (configFilePath) {
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
    getDirectories(db_root).forEach(function (entry) {
        initSingleDatabaseSync(entry);
    });
}

function initSingleDatabaseSync(dbPath) {
    initSingleItem(dbPath, function (dbName, db) {
        all_dbs[dbName] = db;
        db.tables = [];

        getDirectories(dbPath).forEach(function (entry) {
            initSingleTableSync(db, entry)
        });

        console.log('Database \'' + dbName + '\' initialized.');
    });
}

function initSingleTableSync(db, tablePath) {
    initSingleItem(tablePath, function (tableName, table) {
        db.tables[tableName] = table;
    });
}

// used to initialize database or table config files
function initSingleItem(itemPath, successCallback) {
    var configFile = path.resolve(itemPath, ".config");
    var itemName = path.basename(itemPath);
    try {
        var textContents = fs.readFileSync(configFile);
        var item = {};
        item.configuration = JSON.parse(textContents);
        successCallback(itemName, item);
    } catch (err) {
        console.log('ERROR: Unable to open the file ' + configFile);
    }
}

function getDirectories(parentPath) {
    var retVal = [];

    fs.readdirSync(parentPath).filter(function (file) { return fs.statSync(path.join(parentPath, file)).isDirectory(); }
    ).forEach(function (dirName) {
        retVal.push(path.join(parentPath, dirName));
    });

    return retVal;
}

dbManager.prototype.clearCache = function (responder) {
    this.initialize(appConfigFilePath);
    responder.success();
}

//-------------- Database
dbManager.prototype.databaseList = function (responder) {
    var dbs = [];
    Object.keys(all_dbs).forEach(function (item, key) {
        dbs.push(item);
    });
    responder.success(dbs);
}

dbManager.prototype.databaseCreate = function (responder, dbName, configuration) {
    throwIfDbExists(dbName);
    throwIfInvalidDbName(dbName);

    var folderPath = path.join(app_config.db_root, dbName);
    ensureFolderExistsSync(folderPath);

    var dbConfigFile = path.resolve(folderPath, ".config");
    fs.writeFile(dbConfigFile, JSON.stringify(configuration), (err) => {
        if (err)
            return responder.error({ message: err.message });
        console.log('file written:' + dbConfigFile);

        initSingleDatabaseSync(folderPath);
        responder.success();
    });
}

dbManager.prototype.databaseDrop = function (responder, dbName) {
    throwIfDbNotExists(dbName);
    var folderPath = path.join(app_config.db_root, dbName);

    delete all_dbs[dbName];
    rmdirSync(folderPath);
    responder.success();
}

dbManager.prototype.databaseInfo = function (responder, dbName) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];

    var tables = [];
    Object.keys(db.tables).forEach(function (item, key) {
        tables.push(item);
    });
    responder.success(tables);
}

//-------------- Table
dbManager.prototype.tableCreate = function (responder, dbName, tableName, configuration) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];
    throwIfTableExists(db, tableName);

    var folderPath = path.join(app_config.db_root, dbName, tableName);
    ensureFolderExistsSync(folderPath);
    var configFile = path.resolve(folderPath, ".config");
    fs.writeFile(configFile, JSON.stringify(configuration), (err) => {
        if (err)
            return responder.error({ message: err.message });

        console.log('file written:' + configFile);

        initSingleTableSync(db, folderPath);
        responder.success();
    });
}

dbManager.prototype.tableDrop = function (responder, dbName, tableName) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];
    throwIfTableNotExists(db, tableName);

    delete db.tables[tableName];
    var folderPath = path.join(app_config.db_root, dbName, tableName);
    rmdirSync(folderPath);
    responder.success();
}

dbManager.prototype.getData = function (responder, dbName, tableName) {
    throwIfDbNotExists(dbName);
    var db = all_dbs[dbName];
    throwIfTableNotExists(db, tableName);
    var table = db.tables[tableName]
    responder.success(table);
}

function throwIfDbExists(name) {
    if (all_dbs.hasOwnProperty(name))
        throw ({ status: 409, message: 'Database ' + name + ' already exists' });
}

function throwIfDbNotExists(name) {
    if (!all_dbs.hasOwnProperty(name))
        throw ({ status: 404, message: 'Database ' + name + ' not found' });
}

function throwIfInvalidDbName(name) {
    if (name === 'schema')
        throw ({ status: 400, message: 'Invalid database name: ' + name });
}

function throwIfTableExists(db, name) {
    if (db.tables.hasOwnProperty(name))
        throw ({ status: 409, message: 'Table ' + name + ' already exists' });
}

function throwIfTableNotExists(db, name) {
    if (!db.tables.hasOwnProperty(name))
        throw ({ status: 404, message: 'Table ' + name + ' not found' });
}

function ensureFolderExistsSync(localFolderPath) {
    var mkdirSync = function (basePath) {
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
    fs.writeFile(filename, toString, function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("dumpObjectToDisk to '" + filename + "' completed");
    });
}
