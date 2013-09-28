var db = require('nano')('http://isaacs.iriscouch.com/registry'),
	pkgName = process.argv[2],
	app = require('express')(),
	async = require('async'),
	fs = require('fs'),
	cacheFile = './cache.json',
	cache = fs.existsSync(cacheFile) ? require(cacheFile) : {};

function getPackageInfo(name, callback) {
	var fileName = 'cache/' + name + '.json';

	fs.exists(fileName, function (exists) {
		if (exists) {
			fs.readFile(fileName, function (err, json) {
				err ? callback(err) : callback(null, JSON.parse(json));
			});
		} else {
			db.get(name, function (err, data) {
				err ? callback(err) : fs.writeFile(fileName, JSON.stringify(data), function () {
					callback(null, data);
				});
			});
		}
	});
}

function logPackage(pkgName, message) {
	console.log(message.replace('$', '`' + pkgName + '`'));
}

function arrayFirstUnique(array) {
	return array.filter(function (a, b, c) {
		// keeps first occurrence
		return c.indexOf(a) === b;
	});
}

function getNameList(name, callback) {
	var log = logPackage.bind(null, name);

	if (name in cache) {
		log('Got info about $ from cache.');
		return callback(null, cache[name].nameList);
	}

	log('Getting info about $...');

	getPackageInfo(name, function (err, body) {
		if (err) return callback(err);

		var info = body.versions[body['dist-tags'].latest];
		var deps = Object.keys(info.dependencies || {});

		log(deps.length > 0 ? 'Got info about $, retrieving dependencies...' : 'Got all info about $.');

		async.concat(deps, getNameList, function (err, extraDeps) {
			if (err) return callback(err);

			var nameList = arrayFirstUnique([name].concat(deps, extraDeps));

			log('Got all info about $.');

			cache[name] = {
				name: name,
				version: info.version,
				time: body.time[info.version],
				nameList: nameList
			};

			fs.writeFile(cacheFile, JSON.stringify(cache, null, '\t'), function () {
				callback(null, nameList);
			});
		});
	});
}

app.get('/package/:name', function (req, res) {
	getNameList(req.params.name, function (err, nameList) {
		if (err) {
			console.error('Error:', err);
			return res.send(500, err);
		}

		res.send(nameList.map(function (name) { return cache[name] }));
		logPackage(req.params.name, 'Returned info on package $.');
	});
});

app.listen(3000);

console.log('Server is started.');

fs.readdir('cache', function (err, files) {
	var jsonFileRegex = /\.json$/,
		rawCount = files.filter(function (file) { return jsonFileRegex.test(file) }).length,
		completeCount = Object.keys(cache).length;

	if (rawCount > 0) console.log('Found cached raw info about ' + rawCount + ' package(s) (' + completeCount + ' with completed dependencies).');
});