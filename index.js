var db = require('nano')('http://isaacs.iriscouch.com/registry'),
	pkgName = process.argv[2];

db.get(pkgName, function (err, body) {
	console.log(body);
});