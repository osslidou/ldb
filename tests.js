var api = require('./tests.lib')('localhost', 8081);
var util = require('util');
var mod = {};

mod.main = function* () {
    yield* schemaDatabaseTests();
    yield* schemaTableTests();
    yield* dataTests();
}

function* schemaDatabaseTests() {
    console.log('____ schemaDatabaseTests');
    var result = yield api.get('schema');
    var initialCount = result.value.length;
    var dbPath = 'schema/' + api.newGuid();
    yield api.put(dbPath);
    yield api.put(dbPath, null, { code: 409 });

    var invalidDbPath = 'schema/schema';
    yield api.put(invalidDbPath, null, { code: 400 });

    result = yield api.get('schema');
    var newCount = result.value.length;
    if (newCount !== initialCount + 1)
        throw new Error('DB: Failed to create');

    yield api.put('?clearCache');
    result = yield api.get('schema');
    newCount = result.value.length;
    if (newCount !== initialCount + 1)
        throw new Error('Database: Load from cache failure');

    yield api.del(dbPath);
    yield api.del(dbPath, null, { code: 404 });
}

function* schemaTableTests() {
    console.log('____ schemaTableTests');
    var dbPath = 'schema/' + api.newGuid();
    yield api.put(dbPath);

    var result = yield api.get(dbPath);
    var initialCount = result.value.length;

    var tablePath = dbPath + '/' + api.newGuid();
    yield api.put(tablePath);
    yield api.put(tablePath, null, { code: 409 });

    result = yield api.get(dbPath);
    var newCount = result.value.length;
    if (newCount !== initialCount + 1)
        throw new Error('Table: Failed to create');

    yield api.put('?clearCache');
    result = yield api.get(dbPath);
    newCount = result.value.length;
    if (newCount !== initialCount + 1)
        throw new Error('Table: Load from cache failure');

    yield api.del(tablePath);
    yield api.del(tablePath, null, { code: 404 });
    yield api.del(dbPath);
}

function* dataTests() {
    console.log('____ dataTests');
    var dbPath = 'schema/db1';
    var tablePath = dbPath + '/table1';
    yield api.put(dbPath, null, { code: [200, 409] });
    yield api.put(tablePath, null, { code: [200, 409] });

    var dataPath = 'db1/table1'
    var query1 = dataPath + '/?cid=123&_count=10&_fields=firstname,lastname&_walk=reverse'
    var result = yield api.get(query1);

    console.log('result:', result);

    //yield api.del(tablePath);
    //yield api.del(dbPath);
}

mod.tmp = function* () {
    //yield* dataTests();
    //yield* schemaTableTests();
    yield* dataTests();
}


mod.init = function (params) { }

api.runInteractive(mod, process.argv);