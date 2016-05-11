var querystring = require('querystring');
var http = require('http');

module.exports = function(hostname, port) {
    var module = {};

    module.runAndCheck = function runAndCheck(request, data, expected) {
        if (typeof request.timeout === 'undefined')
            request.timeout = 2;

        if (typeof expected === 'undefined')
            expected = {};

        if (typeof expected.code === 'undefined')
            expected.code = [200];

        else if (!(expected.code.constructor === Array))
            expected.code = [expected.code];

        runHttpRequest(request, data, function(current) {

            var checkOk = expected.code.indexOf(current.statusCode) > -1;

            if (checkOk && (typeof expected.value !== 'undefined'))
                checkOk = JSON.stringify(expected.value) === JSON.stringify(current.value);

            if (checkOk) {
                //console.log(current); - disabling because of the screenshot
                it.next(current);
            } else {
                var e = {};
                e.expected = expected;
                e.__current = current;
                it.throw(e);
            }
        });
    }

    module.longId = function() {
        return this.shortId() + '-' + this.shortId() + '-' + this.shortId();
    }

    module.shortId = function() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return module;

    function runHttpRequest(request, data, cb) {
        var options = {
            host: hostname,
            port: port,
            path: encodeURI(request.path),
            method: request.verb
        };

        options.headers = { 'x-timeout-in-sec': request.timeout }; /* webft request timeout*/

        if (data) {
            data = querystring.stringify(data);
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            options.headers['Content-Length'] = data.length;
        }

        console.log('\n[' + options.method + ']', decodeURI(options.path));
        var retVal = {};

        var req = http.request(options, function(res) {
            res.setEncoding('utf8');

            retVal.value = '';
            retVal.statusCode = res.statusCode;

            res.on('data', function(chunk) {
                retVal.value += chunk;
            });

            res.on('end', function() {
                if (retVal.value)
                    retVal.value = JSON.parse(retVal.value);

                cb(retVal);
            });
        });

        req.on('error', function(e) {
            retVal.error = e;
            cb(retVal);
        });

        if (data)
            req.write(data);

        req.end();
    }
}