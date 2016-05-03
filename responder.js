module.exports.responder = function(res) {
    var module = {};

    module.success = function(data) {
        console.log('responding success...');

        if (data)
            res.send(data);
        else {
            res.writeHead(200);
            res.end();
        }
    }

    module.error = function(err) {
        console.log('responding error...');

        if (err.status)
            res.status(err.status).json(err.message);

        else
            res.status(500).json(err.message);

        res.end();
    }
    return module;
}