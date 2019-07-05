/**
 * @fileOverview Server implementation
 * @name server.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Townsville.nl
 */

"use strict";

const AuthHandler = require('./auth-handler');
const common = require('./common');
const events = require('events');
const exceptions = require('./exceptions');
const http = require('http');
const https = require('https');
const fs = require('fs');
const util = require('util');
const zlib = require('zlib');
const decache = require('decache');
const auth = require('basic-auth');


class JsonRestServer extends events.EventEmitter {

  /**
   * Class constructor
   * @constructor
   * @param {Object} settings Settings for server
   * @param {Object} logger Optional logger
   */
  constructor(settings, logger) {

    // Call super
    super();
    events.EventEmitter.call(this);

    // If we have a logger, create a log instance
    if (logger instanceof Object) {
      this._log = logger.createLogger('json-rest-server');
    }

    this._init(settings, logger);
  }

  /**
   * Add action for route
   * @param {string} route Route / Path
   * @param {function} action Action class extended from base-action.js
   */
  addAction(action) {

    /*
    {
      "name": "CS Test Route 1",
      "validUsers": [
        "test1"
      ],
      "route": "/cs/test/1/",
      "action": "cs-test-1",
      "parameters": [{
        "path": "/tmp/1/"
      }]
    */

    this._actions[action.route] = action;
  }


  /**
   * Run server
   */
  run() {
    this._server.listen(this._port, this._host);

    if (this._log && this._log.isDebug()) {
      this._log.debug('Server listening at %s://%s:%d',
        this._serverType, this._host, this._port);
    }
  }

  /**
   * Close server
   *@param {function} callback Optional callback
   */
  close(callback) {
    if (this._server) {
      this._server.close(callback);
      return;
    }
    if (callback) {
      callback();
    }
  }

  // ---- Private ----


  /**
   * Initialize rest server
   * @param {Object} settings Server settings
   * @param {Object} logger Logger
   * @throws {Error} If settings suck
   */
  _init(settings, logger) {

    if (!settings) {
      throw new Error('Settings are required');
    }

    this._port = settings.port;
    if (isNaN(this._port)) {
      this._port = common.CONST.DEFAULT_PORT;
    }
    this._host = settings.host;
    if (typeof (this._host) !== 'string') {
      this._host = common.CONST.DEFAULT_HOST;
    }

    // Whether to expose error cause in response
    this._exposeCause = settings.exposeCause ? true : false;

    // Max length of messages contents to log
    this._maxLenMsgLog = settings.maxLenMsgLog;
    if (isNaN(this._maxLenMsgLog)) {
      this._maxLenMsgLog = common.CONST.DEFAULT_MAX_LEN_MSG_LOG;
    }

    // Setup authentication when required
    if (settings.auth) {
      this._authHandler = new AuthHandler(settings.auth, logger);
    }

    // Setup action handlers
    this._actions = {};

    // Determine server type
    this._serverType = settings.serverType;
    if (!this._serverType || typeof (this._serverType) !== 'string') {
      this._serverType = common.CONST.DEFAULT_SERVER_TYPE;
    } else {
      this._serverType = this._serverType.toLowerCase();
    }

    if (this._serverType === 'https') {
      //sanity check
      var caEntries;
      var sslOptions = {};
      //check if CA = array..
      if (settings.ca instanceof Array) {
        caEntries = [];
        if (typeof (settings.key) !== 'string' ||
          typeof (settings.cert) !== 'string' ||
          typeof (settings.requestCert) !== 'boolean' ||
          typeof (settings.rejectUnauthorized) !== 'boolean') {
          throw new Error('HTTPS Settings are required when servertype == https');
          //get all the CA entries
        }
        settings.ca.forEach(function (caEntry) {
          caEntries.push(fs.readFileSync(caEntry));
        });
      } else {
        caEntries = "";
        if (typeof (settings.key) !== 'string' ||
          typeof (settings.cert) !== 'string' ||
          typeof (settings.ca) !== 'string' ||
          typeof (settings.requestCert) !== 'boolean' ||
          typeof (settings.rejectUnauthorized) !== 'boolean') {
          throw new Error('HTTPS Settings are required when servertype == https');
        }
        caEntries = fs.readFileSync(settings.ca);
      }
      sslOptions = {
        key: fs.readFileSync(settings.key),
        cert: fs.readFileSync(settings.cert),
        ca: caEntries,
        requestCert: settings.requestCert,
        rejectUnauthorized: settings.rejectUnauthorized
      };
      //setup the sslOptions object
      this._server = https.createServer(sslOptions);
    } else {
      this._server = http.createServer();
    }

    this._server.on('error', (err) => {
      this.emit('error',
        new Error('Server error: ' + err.message));
    });

    this._server.on('request', (req, res) => {

      // Get path
      let path = req.url;
      // Get path handler (if any)
      let action = this._actions[path];
      // Determine client id
      let clientId = util.format(
        '%s_%d', req.connection.remoteAddress, req.connection.remotePort);

      // Determine encoding (compression)
      let compression;
      if (req.headers) {
        compression = req.headers['content-encoding'];
      }

      // Debug
      if (this._log && this._log.isDebug()) {
        this._log.debug('Request from %s for path "%s" (enc: "%s")',
          clientId, path, compression);
      }

      // No handler for this path

      if (typeof (action) !== 'object') {
        this._log.debug("404 not found");
        this._send(res, clientId, common.CONST.HTTP_NOT_FOUND,
          undefined, compression);
        return;
      }

      /*
      {
        "name": "CS Test Route 1",
        "validUsers": [
          "test1"
        ],
        "route": "/cs/test/1/",
        "action": "cs-test-1",
        "parameters": [{
          "path": "/tmp/1/"
        }]
      }
      */

      // Handler object maken
      
      
      // Handle (optional) authentication
      if (this._authHandler) {
        if (!this._authHandler.isAuthorized(req)) {
          let realm = this._authHandler.getRealm();
          res.setHeader('WWW-Authenticate', `Basic realm="${realm}"`);
          this._send(res, clientId, common.CONST.HTTP_UNAUTHORIZED,
            undefined, compression);
          return;
        }
      }

      let user = auth(req);
      if (action.validUsers.indexOf(user.name) < 0) {
        // this user is invalid..
        this._send(res, clientId, common.CONST.HTTP_UNAUTHORIZED,
          "INVALID USER", compression);
        return;
      }

      decache(global.appRoot + '/actions/' + action.action);
      let a = require(global.appRoot + '/actions/' + action.action);
      let handler = new a(action);

      // Init receive buffer and request object
      let buffer = new Buffer.alloc(0);
      let reqObj;

      req.on('data', (data) => {
        // Add new data to buffer
        buffer = Buffer.concat([buffer, data]);
      });

      req.on('end', () => {
        // Keep track of actual size for debug log
        let actSize = buffer.length;

        try {
          switch (compression) {
            case common.CONST.ENC_DEFLATE:
              try {
                try {
                  buffer = zlib.inflateSync(buffer);
                } catch (err) {
                  // Fall back to raw inflate (PHP)
                  buffer = zlib.inflateRawSync(buffer);
                  // Overwrite the compression type, so the response will be raw also
                  compression = common.CONST.ENC_DEFLATE_RAW;
                }
              } catch (err) {
                throw new Error(util.format(
                  'Invalid %s compression from %s',
                  common.CONST.ENC_DEFLATE, clientId));
              }
              break;
            case common.CONST.ENC_GZIP:
              try {
                buffer = zlib.gunzipSync(buffer);
              } catch (err) {
                throw new Error(util.format(
                  'Invalid %s compression from %s',
                  common.CONST.ENC_GZIP,
                  clientId));
              }
              break;
            case null:
            case undefined:
              break;
            default:
              let badCompression = compression;
              compression = undefined;
              throw new Error(util.format(
                'Unsupported compression method from %s: %s',
                clientId, badCompression));
          }

          // Try to make sense of the buffer
          try {
            reqObj = JSON.parse(buffer.toString('utf8'));
          } catch (err) {
            throw new Error(
              util.format(
                'Invalid JSON request from %s: %s',
                clientId,
                common.limitedLogMsg(buffer, this._maxLenMsgLog)));
          }

          // Debug
          if (this._log && this._log.isDebug()) {
            this._log.debug('Request object (act=%d/full=%d bytes) from %s',
              actSize,
              buffer.length,
              clientId);
          }
        } catch (err) {
          this.emit('error', err);
        }

        // Not a valid request
        if (!reqObj) {
          this._send(res, clientId, common.CONST.HTTP_BAD_REQUEST,
            undefined, compression);
          return;
        }

        handler.process(reqObj, (err, resObj) => {
          if (err) {

            let msg = err.message;
            if (this._log) {
              this._log.warn('Handler reported an error: ' + msg);
            }

            // If not expose cause, wipe message
            if (!this._exposeCause) {
              msg = undefined;
            }

            if (err instanceof exceptions.BadRequest) {
              this._send(res, clientId,
                common.CONST.HTTP_BAD_REQUEST, msg,
                compression);
            } else if (err instanceof exceptions.NotFound) {
              this._send(res, clientId,
                common.CONST.HTTP_NOT_FOUND, msg,
                compression);
            } else if (err instanceof exceptions.InternalServerError) {
              this._send(res, clientId,
                common.CONST.HTTP_INTERNAL_SERVER_ERROR, msg,
                compression);
            } else {
              this._send(res, clientId,
                common.CONST.HTTP_SERVICE_UNAVAILABLE, msg,
                compression);
            }
          } else {
            this._send(res, clientId, common.CONST.HTTP_OK, resObj, compression);
          }
        });
      });

    });
  }


  /**
   * Send back JSON response
   * @param {Object} res Response object
   * @param {number} code Http code
   * @param {Object} contents Contents
   * @param {string} compression Compression (optional)
   */
  _send(res, clientId, code, contents, compression) {

    if (contents === undefined) {
      contents = {
        code: code,
        message: http.STATUS_CODES[code]
      };
    } else if (code !== common.CONST.HTTP_OK &&
      typeof (contents) === 'string') {
      contents = {
        code: code,
        message: contents
      };
    }

    // Minimum headers
    let headers = {
      'Content-Type': 'application/json'
    };

    // Get json string presentation
    let jsonStr = JSON.stringify(contents);

    // Apply compression when required
    let retVal;
    switch (compression) {
      case common.CONST.ENC_DEFLATE:
        retVal = zlib.deflateSync(jsonStr);
        headers['Content-Encoding'] = common.CONST.ENC_DEFLATE;
        break;
      case common.CONST.ENC_DEFLATE_RAW:
        // Deflate raw
        retVal = zlib.deflateRawSync(jsonStr);
        // Use normal/non-raw deflate in encoding
        headers['Content-Encoding'] = common.CONST.ENC_DEFLATE;
        break;
      case common.CONST.ENC_GZIP:
        retVal = zlib.gzipSync(jsonStr);
        headers['Content-Encoding'] = common.CONST.ENC_GZIP;
        break;
      case null:
      case undefined:
        retVal = jsonStr;
        break;
      default:
        // Just in case
        throw new Error(util.format(
          'Unsupported compression method from %s: %s',
          clientId, compression));
    }

    // Handle response
    res.writeHead(code, headers);
    res.end(retVal);

    // Debug
    if (this._log && this._log.isDebug()) {
      this._log.debug(
        'Reply, code %d (%s), act=%d/full=%d bytes, to %s: %s',
        code, http.STATUS_CODES[code], retVal.length, jsonStr.length,
        clientId, common.limitedLogMsg(jsonStr, this._maxLenMsgLog));
    }
  }
}

// Exports
module.exports = JsonRestServer;