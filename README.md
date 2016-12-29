# sdb
sdb is a simple/small node.js REST API database server

### Schema
verb | path | arguments | description
--- | --- | --- | ---
[GET] | /schema        || returns all databases
[PUT] | /schema/db1    || creates db1 with default options
[GET] | /schema/db1    || returns database info
[DEL] | /schema/db1    || drops db1
[PUT] | /schema/db1/table1 || creates table1 with default options

### Data
verb | path | arguments | description
--- | --- | --- | ---
[PUT] | /?clearCache || clears the cache (reload from disk)
[POST] | /db1/table1 | {cid=123, id=abc, name='BC Hydro'} | creates  -> {cid:123, id:abc, name:'BC Hydro'}
[PUT] | /db1/table1 | {cid=123, id=abc, name='BC Hydro2'} | updates  -> {cid:123, id:abc, name:'BC Hydro2'}
[DEL] | /db1/table1 | {cid=123, id=abc } | deletes  -> {cid:123, id:abc, name:'BC Hydro2'}
[GET] | /db1/table1?cid=123&_count=10&_fields=firstname,lastname&_walk=reverse || returns the list of items where cid is '123'