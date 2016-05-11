var tools = require('./tests.lib')('localhost', 8081);
var params = {};
// note: 'it' / yield iterator is a global var for now...

process.argv.forEach(function(val, index, array) {
    if (index >= 2) // 0:node 1:filename
        params[val] = true;
});

if (params['main']) {
    delete params['main'];
    it = main();
}
else if (params['temp']) {
    delete params['temp'];
    it = temp();
}
else {
    console.log(' parameter required: main or temp');
    return;
}

if (it)
    it.next();

function* databaseTests() {
    var result = yield tools.runAndCheck({ verb: 'get', path: '/' });
    var initialCount = result.value.length;
    var dbPath = '/' + tools.longId();
    yield tools.runAndCheck({ verb: 'put', path: dbPath });
    yield tools.runAndCheck({ verb: 'put', path: dbPath }, null, { code: 409 });

    result = yield tools.runAndCheck({ verb: 'get', path: '/' });
    var newCount = result.value.length;
    if (newCount !== initialCount + 1)
        throw new Error('DB: Failed to create');

    yield tools.runAndCheck({ verb: 'put', path: '/?clearCache' });
    result = yield tools.runAndCheck({ verb: 'get', path: '/' });
    newCount = result.value.length;
    if (newCount !== initialCount + 1)
        throw new Error('DB: Load from cache failure');

    yield tools.runAndCheck({ verb: 'delete', path: dbPath });
    yield tools.runAndCheck({ verb: 'delete', path: dbPath }, null, { code: 404 });
}

function* tableTests() {
    var dbPath = '/' + tools.longId();
    yield tools.runAndCheck({ verb: 'put', path: dbPath });

    var result = yield tools.runAndCheck({ verb: 'get', path: dbPath });
    var initialCount = result.value.length;

    var tablePath = dbPath + '/' + tools.longId();
    yield tools.runAndCheck({ verb: 'put', path: tablePath });
    yield tools.runAndCheck({ verb: 'put', path: tablePath }, null, { code: 409 });

    result = yield tools.runAndCheck({ verb: 'get', path: dbPath });
    var newCount = result.value.length;
    if (newCount !== initialCount + 1)
        throw new Error('Table: Failed to create');

    yield tools.runAndCheck({ verb: 'delete', path: tablePath });
    yield tools.runAndCheck({ verb: 'delete', path: tablePath }, null, { code: 404 });
    yield tools.runAndCheck({ verb: 'delete', path: dbPath });
}

function* workerTests() {
    var dbPath = '/' + tools.longId();
    yield tools.runAndCheck({ verb: 'put', path: dbPath });

    var tablePath = dbPath + '/' + tools.longId();
    yield tools.runAndCheck({ verb: 'put', path: tablePath });

    var result = yield tools.runAndCheck({ verb: 'get', path: tablePath });
    var initialCount = result.value.length;

    var workerPath = tablePath + '/' + tools.longId();
    yield tools.runAndCheck({ verb: 'put', path: workerPath }, { type: 'view' });
    yield tools.runAndCheck({ verb: 'put', path: workerPath }, null, { code: 409 });

    result = yield tools.runAndCheck({ verb: 'get', path: tablePath });
    var newCount = result.value.length;
    if (newCount !== initialCount + 1)
        throw new Error('Worker: to create');

    yield tools.runAndCheck({ verb: 'delete', path: workerPath });
    yield tools.runAndCheck({ verb: 'delete', path: workerPath }, null, { code: 404 });
    yield tools.runAndCheck({ verb: 'delete', path: tablePath });
    yield tools.runAndCheck({ verb: 'delete', path: dbPath });
}

function* dataCrudTests() {
    var dbPath = '/' + tools.longId();
    yield tools.runAndCheck({ verb: 'put', path: dbPath });

    var tablePath = dbPath + '/' + tools.longId();
    yield tools.runAndCheck({ verb: 'put', path: tablePath });
    
    var workerPath = tablePath + '/' + tools.longId();
    yield tools.runAndCheck({ verb: 'put', path: workerPath });
    yield tools.runAndCheck({ verb: 'put', path: workerPath }, null, { code: 409 });

    result = yield tools.runAndCheck({ verb: 'get', path: tablePath });
    var newCount = result.value.length;
    if (newCount !== initialCount + 1)
        throw new Error('Worker: to create');

    yield tools.runAndCheck({ verb: 'delete', path: workerPath });
    yield tools.runAndCheck({ verb: 'delete', path: workerPath }, null, { code: 404 });
    yield tools.runAndCheck({ verb: 'delete', path: tablePath });
    yield tools.runAndCheck({ verb: 'delete', path: dbPath });
}

function* main() {
    try {

        yield* databaseTests();
        yield* tableTests();
        yield* workerTests();
        yield* dataCrudTests();

        /*
        OK tues: db: list, create, drop
        OK wednesday: table: list, create, drop
        thursday: restart, view: list, create, drop
        friday: table: crud
        monday: view: usage
                
        // structure
        [PUT]   /?clearCache                            clear cache & reinit the db structure
        [GET]   /                                       return the list of DBs
        [PUT]   /db1                                    create db1 with default options
        [PUT]   /db1   {opt1:123}                       create or update db1 with opt1
        [DEL]   /db1                                    drop db1
        [PUT]   /db1/table1                             create table1 with default options
        [PUT]   /db1/table1      {file=cid}             create table1 with 'one file per cid' - cid becomes required for all queries
        [PUT]   /db1/table1/view1  {type:view, walk:'reverse',sort:'digit'}    create view1 with passed-in definition { function{arg, doc}{ emit(sortKey, {value});}}
        [PUT]   /db1/table1/job1   {type:job}             create job1 that defines set of actions on the table (delete all records where age>1yr)
        
        // contents
        [PUT]   /db1/table1?cid=123&id=abc {name='BC Hydro'} create/update  -> {cid:123, id:abc, name:'BC Hydro'}
        [POST]  /db1/table2  {cid=123, text='login at 1pm'} append only (not loading data file in memory) -> {cid:123, text:'login at 1pm'}
    
        [GET]   /db1/table1/view1?cid=123&count=10      returns list of items with view argument cid set to '123'    
        
        loadTableFile(); - all
        saveTableFile(); - all        
        */

        /*
        yield tools.runAndCheck({ verb: 'put', path: '/b1?type=chrome' }, null, { code: [200, 409] });
        result = yield tools.runAndCheck({ verb: 'post', path: '/b1/page/div/.list1?set_var' });
                yield tools.runAndCheck({ verb: 'get', path: '/b1/page/$0/li/eq(0)?text&' + result.value }, null, { value: 'item 1' });
        */

        console.log("-- SUCCESS\n");
    }
    catch (e) {
        console.log("-- ERROR:\n", e);
    }
}

function* temp() {
    try {
        /* 
        var result = result = yield tools.runAndCheck({ verb: 'get', path: '/' });
           console.log(result);
           
          */

        var workerPath = '/db1/table1/' + tools.longId();
        yield tools.runAndCheck({ verb: 'put', path: workerPath }, { walk: "reverse", sort: "digit" });

        console.log("-- SUCCESS\n");
    }
    catch (e) {
        console.log("ERROR:", e);
    }
}