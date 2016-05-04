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
[PUT] | /db1/table1 | {file=cid} | create table1 with 'one file per cid' - cid becomes required for all queries
[PUT] | /db1/table1/view1 | {walk:reverse,sort:digit} | create view1 with passed-in definition { function{arg, doc}{ emit(sortKey, {value});}}
[GET] | /db1/table1/view1?cid=123&count=10 || returns list of items with view argument cid set to '123'
[PUT] | /db1/table1/job1 || create job1 that defines set of actions on the table (delete all records where age>1yr)

### Contents
verb | path | arguments | description
--- | --- | --- | ---
[PUT] | /db1/table1?cid=123&id=abc | {name='BC Hydro'} | create/update  -> {cid:123, id:abc, name:'BC Hydro'}
[POST] | /db1/table2 | {cid=123, text='login at 1pm'} | append only (not loading data file in memory) -> {cid:123, text:'login at 1pm'}