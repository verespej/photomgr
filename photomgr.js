var fs = require('fs'),
	path = require('path'),
	exif = require('exif').ExifImage,
	crypto = require('crypto');

var _rootOutputDirPath = '_output';
var _metadataFile = path.join(_rootOutputDirPath, '_metadata.txt');

function processDir(dirPath) {
	if (dirPath === _rootOutputDirPath) {
		 return;
	}

	fs.readdir(dirPath, function(err, files) {
		if (err) {
			console.log('ERROR: (' + dirPath + ') ' + err);
		}
		files.forEach(function(localPath) {
			var fullPath = path.join(dirPath, localPath);
			fs.stat(fullPath, function(err, stats) {
				if (err) {
					console.log('ERROR: (' + fullPath + ') ' + err);
				} else if (stats.isFile()) {
					var fileType = path.extname(localPath);
					switch (fileType.toLowerCase()) {
						case '.jpeg':
						case '.jpg':
							handleJpeg(fullPath, _rootOutputDirPath);
							break;
						case '.mov':
							handleMov(fullPath, _rootOutputDirPath);
							break;
						default:
							// File type note supported - skip
							break;
					}
				} else if (stats.isDirectory()) {
					processDir(fullPath);
				}
			});
		});
	});
}

function handleJpeg(filePath, rootOutputDir) {
	try {
		new exif({ image: filePath }, function(err, exifData) {
			if (err) {
				console.log('ERROR: (' + filePath + ') ' + err);
			} else {
				var match = /^(\d\d\d\d):(\d\d):(\d\d.*)$/.exec(exifData.exif.CreateDate);
				var dateStr = match[1] + '-' + match[2] + '-' + match[3];
				var date = new Date(dateStr);
				handleFile(filePath, rootOutputDir, date.toISOString());
			}
		});
	} catch (err) {
		console.log('ERROR: (' + filePath + ') ' + err);
	}
}

function handleMov(filePath, rootOutputDir) {
	fs.stat(filePath, function(err, stats) {
		if (err) {
			console.log('ERROR: (' + filePath + ') ' + err);
		} else {
			handleFile(filePath, rootOutputDir, stats.mtime.toISOString());
		}
	});
}

function handleFile(filePath, rootOutputDir, creationTimeUtcIsoStr) {
	calcChecksum(filePath, function(checksumErr, checksum) {
		if (checksumErr) {
			console.log('ERROR (' + filePath + '): ' + checksumErr);
		} else {
			var cts = creationTimeUtcIsoStr.replace(/:/g, '-');
			var newDirPath = createDirectoryPathSync(rootOutputDir, cts);
			var newName = cts + '.' + checksum + path.extname(filePath);
			var newPath = path.join(newDirPath, newName);
			if (fs.existsSync(newPath)) {
				console.log('WARNING: Wanted to rename ' + filePath + ' to ' + newPath + ', but destination file already exists');
			} else {
				console.log('Renaming ' + filePath + ' to ' + newPath);
				fs.rename(filePath, newPath, function(renameErr) {
					if (renameErr) {
						console.log('ERROR (' + filePath + '): ' + renameErr);
					} else {
						fs.appendFile(_metadataFile, filePath + ', ' + checksum + '\n', function(metadataAppendErr) {
							if (metadataAppendErr) {
								console.log('ERROR (' + _metadataFIle + '): ' + metadataAppendErr);
							}
						});
					}
				});
			}
		}
	});
}

function createDirectoryPathSync(rootDirPath, timeStr) {
	var match = /^(\d\d\d\d)[^\d](\d\d)[^\d]/.exec(timeStr);

	if (!fs.existsSync(rootDirPath)) {
		fs.mkdirSync(rootDirPath);
	}

	var dirPath = path.join(rootDirPath, match[1]);
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath);
	}

	dirPath = path.join(rootDirPath, match[1], match[2]);
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath);
	}

	return dirPath;
}

function calcChecksum(filePath, cb) {
	var hash = crypto.createHash('md5');
	var stream = fs.ReadStream(filePath);

	stream.on('data', function(data) {
		hash.update(data);
	});

	stream.on('error', cb);

	stream.on('end', function() {
		cb(null, hash.digest('hex'));
	});
}

processDir('.');

