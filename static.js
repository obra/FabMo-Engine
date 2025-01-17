// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var fs = require('fs');
var path = require('path');
var escapeRE = require('escape-regexp-component');

var assert = require('assert-plus');
var mime = require('mime-types');
var errors = require('restify-errors');
var config = require('./config');

///--- Globals

var MethodNotAllowedError = errors.MethodNotAllowedError;
var NotAuthorizedError = errors.NotAuthorizedError;
var ResourceNotFoundError = errors.ResourceNotFoundError;


///--- Functions

/**
 * serves static files.
 * @public
 * @function serveStatic
 * @param    {Object} options an options object
 * @throws   {MethodNotAllowedError |
 *            NotAuthorizedError |
 *            ResourceNotFoundError}
 * @returns  {Function}
 */
function serveStatic(options) {
    var opts = options || {};

    if (typeof opts.appendRequestPath === 'undefined') {
        opts.appendRequestPath = true;
    }

    assert.object(opts, 'options');
    assert.string(opts.directory, 'options.directory');
    assert.optionalNumber(opts.maxAge, 'options.maxAge');
    assert.optionalObject(opts.match, 'options.match');
    assert.optionalString(opts.charSet, 'options.charSet');
    assert.optionalString(opts.file, 'options.file');
    assert.bool(opts.appendRequestPath, 'options.appendRequestPath');

    var p = path.normalize(opts.directory).replace(/\\/g, '/');
    var re = new RegExp('^' + escapeRE(p) + '/?.*');

    function serveFileFromStats(file, err, stats, isGzip, req, res, next) {

        if (typeof req.connectionState === 'function' &&
            (req.connectionState() === 'close' ||
            req.connectionState() === 'aborted')) {
            next(false);
            return;
        }

        if (err) {
            next(new ResourceNotFoundError(err, '%s', req.path()));
            console.log("resource not found: " + file);
            return;
        } else if (!stats.isFile()) {
            next(new ResourceNotFoundError('%s does not exist', req.path()));
            return;
        }

        if (res.handledGzip && isGzip) {
            res.handledGzip();
        }

        var fstream = fs.createReadStream(file + (isGzip ? '.gz' : ''));
        var maxAge = opts.maxAge === undefined ? 3600 : opts.maxAge;
        fstream.once('open', function (fd) {
            res.cache({maxAge: maxAge});
            res.set('Content-Length', stats.size);
            res.set('Content-Type', mime.lookup(file));
            res.set('Last-Modified', stats.mtime);

            if (opts.charSet) {
                var type = res.getHeader('Content-Type') +
                    '; charset=' + opts.charSet;
                res.setHeader('Content-Type', type);
            }

            if (opts.etag) {
                res.set('ETag', opts.etag(stats, opts));
            }
            res.writeHead(200);
            fstream.pipe(res);
            fstream.once('close', function () {
                next(false);
            });
        });

        res.once('close', function () {
            fstream.close();
        });
    }

    function serveNormal(file, req, res, next) {
        fs.stat(file, function (err, stats) {
            if (!err && stats.isDirectory() && opts.default) {
                // Serve an index.html page or similar
                var filePath = path.join(file, opts.default);
                fs.stat(filePath, function (dirErr, dirStats) {
                    serveFileFromStats(filePath,
                        dirErr,
                        dirStats,
                        false,
                        req,
                        res,
                        next);
                });
            } else {
                serveFileFromStats(file,
                    err,
                    stats,
                    false,
                    req,
                    res,
                    next);
            }
        });
    }

    function serve(req, res, next) {
        var file;
        var path_arr = req.path().split('/')

        for(var i = 0; i < path_arr.length; i++){
            if(path_arr[i] === config.engine.get('version')) {
                path_arr.splice(i, 1);
            }
        }

        if (path_arr.length > 1) {
            var newPath = path_arr.join('/');
        } else {
            var newPath = '/';
        }
       
        req.url = newPath;

        if (opts.file) {
            //serves a direct file
            file = path.join(opts.directory,
                decodeURIComponent(opts.file));
        } else {

            if (opts.appendRequestPath) {
                file = path.join(opts.directory,
                    decodeURIComponent(req.path()));
            }
            else {
                var dirBasename = path.basename(opts.directory);
                var reqpathBasename = path.basename(req.path());

                if (path.extname(req.path()) === '' &&
                    dirBasename === reqpathBasename) {
     
                    file = opts.directory;
                }
                else {
                    file = path.join(opts.directory,
                        decodeURIComponent(path.basename(req.path())));
                }
            }
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            console.log("static open 1 bad method: " + file);
            next(new MethodNotAllowedError(req.method));
            return;
        }

        if (!re.test(file.replace(/\\/g, '/'))) {
            console.log("static open 1 could not replace slashes: " + file);
            next(new NotAuthorizedError('%s', req.path()));
            return;
        }

        if (opts.match && !opts.match.test(file)) {
            console.log("static open 1 could not authorized: " + file);
            next(new NotAuthorizedError('%s', req.path()));
            return;
        }

        if (opts.gzip && req.acceptsEncoding('gzip')) {
            fs.stat(file + '.gz', function (err, stats) {
                if (!err) {
                    res.setHeader('Content-Encoding', 'gzip');
                    serveFileFromStats(file,
                        err,
                        stats,
                        true,
                        req,
                        res,
                        next);
                } else {
                    serveNormal(file, req, res, next);
                }
            });
        } else {
            serveNormal(file, req, res, next);
        }

    }

    return (serve);
}

module.exports = serveStatic;
