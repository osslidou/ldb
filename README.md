# ldb
ldb is a lightweight node.js REST API database implementation

### Structure
verb | path | arguments | description
--- | --- | --- | ---
[PUT] | /?clearCache || clear cache & reinit the db structure
[GET] | / || return the list of DBs
[PUT] | /db1 || create db1 with default options
[PUT] | /db1 | {opt1:123} | create or update db1 with opt1
[DEL] | /db1 || drop db1
[PUT] | /db1/table1 || create table1 with default options

### Contents
verb | path | arguments | description
--- | --- | --- | ---
[PUT] | /db1/table1/data | {cid=123, id=abc, name='BC Hydro'} | create/update  -> {cid:123, id:abc, name:'BC Hydro'}
[DEL] | /db1/table1/data | {cid=123, id=abc } | delete where cid=123 and id=abc
[DEL] | /db2/table1/data | {createDate < '2010/01/01'}

[GET] | /db1/table1/data || gets table contents
[GET] | /db1/table1/data?walk=reverse&cid=123&count=10 || returns list of items where cid is '123'