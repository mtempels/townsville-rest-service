/**
 * @fileOverview Client implementation
 * @name client.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Townsville.nl
 */

"use strict";

const common = require('./common');
const events = require('events');
const http = require('http');
const https = require('https');
const fs = require('fs');
const util = require('util');
const zlib = require('zlib');


class JsonRestClient extends events.EventEmitter {

  /**
   * Class constructor
   * @param {Object} settings Client settings
   * @param {Object} logger Optional logger object
   */
  constructor(settings, logger) {

    super();

    // If we have a logger, create a log instance
    if (logger instanceof Object) {
      this._log = logger.createLogger('json-rest-client');
    }

    this._init(settings);
  }


  /**
   * Post a request
   * @param {string} path Path to post to
   * @param {Object} object Object to post
   * @param {callback} callback Called when done
   */
  post(path, reqObject, callback) {

    let callbackCalled = false;

    // Set proper path
    this._options.path = path;

    // Request
    let client = this._clientType === "https" ? https : http;

    let req = client.request(this._options, (res) => {
      let code = res.statusCode;
      let compression;
      if (res.headers) {
        compression = res.headers['content-encoding'];
      }

      // Read data into buffer
      let buffer = new Buffer(0);
      res.on('data', (data) => {
        buffer = Buffer.concat([buffer, data], buffer.length + data.length);
      });

      // Upon end of data
      res.on('end', () => {

        let actSize = buffer.length;

        // Handle compression (if any)
        try {
          switch(compression) {
          case common.CONST.ENC_DEFLATE:
            try {
              buffer = zlib.inflateSync(buffer);
            } catch(err) {
              // Fall back to raw inflate (PHP)
              buffer = zlib.inflateRawSync(buffer);
            }
            break;
          case common.CONST.ENC_GZIP:
            buffer = zlib.gunzipSync(buffer);
            break;
          case null:
          case undefined:
            break;
          default:
            callback(new Error(util.format(
              'Invalid compression encountered: "%s"', compression)));
            return;
          }
        } catch (err) {
          callback(new Error(util.format(
              'Failed to uncompress using "%s" compression: "%s"',
            compression, err.message)));
          return;
        }

        let resStr;
        let resObject;
        try {
          resStr = buffer.toString('utf8');
          resObject = JSON.parse(resStr);
        } catch(err) {
          // Handled later
        }

        // Debug
        if (this._log && this._log.isDebug()) {
          this._log.debug(
            'Response data (code %d, enc: "%s", act=%d/full=%s bytes): %s',
            code, compression, actSize, resStr ? resStr.length : 0,
            common.limitedLogMsg(resStr,
                                 this._maxLenMsgLog));
        }

        // Code signals ok
        if (code === common.CONST.HTTP_OK) {

          if (resObject !== undefined) {
            callback(null, resObject);
          } else {
            callback(new Error('Invalid JSON reply'));
          }
        } else {
          callback(
            new Error(util.format(
              'Reply code %d (%s)',
              code, http.STATUS_CODES[code])),
            resObject);
        }
        callbackCalled = true;
      });
    });

    req.on('error', (err) => {
      if (!callbackCalled) {
        callback(err);
        callbackCalled = true;
      }
    });

    req.on('timeout', () => {
      if (!callbackCalled) {
        callback(new Error('Timeout'));
        callbackCalled = true;
      }
      req.abort();
    });

    // Set timeout when supplied
    if (this._timeout > 0) {
      req.setTimeout(this._timeout);
    }

    // Get json string to post
    let jsonStr = JSON.stringify(reqObject);

    // Post
    if (this._compression) {
      if (this._compression === common.CONST.ENC_GZIP) {
        zlib.gzip(jsonStr, (err, buffer) => {
          if (err) {
            callback(err);
            callbackCalled = true;
            req.abort();
          } else {
            this._logWrite(jsonStr.length, buffer.length);
            req.write(buffer);
            req.end();
          }
        });
        return;
      }
      if (this._compression === common.CONST.ENC_DEFLATE) {
        zlib.deflate(jsonStr, (err, buffer) => {
          if (err) {
            callback(err);
            callbackCalled = true;
            req.abort();
          } else {
            this._logWrite(jsonStr.length, buffer.length);
            req.write(buffer);
            req.end();
          }
        });
        return;
      }
      throw new Error('Unhandled compression: ' +  this._compression);

    } else {
      // No compression
      this._logWrite(jsonStr.length);
      req.write(jsonStr);
      req.end();
    }

  }


  // ---- Private -----


  /**
   * Initialize client
   * @param {Object} settings
   * @throws {Error} If settings are missing
   */
  _init(settings) {

    if (!settings) {
      throw new Error('Settings are required');
    }

    // Init (default) options
    this._options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    this._clientType = settings.clientType;
    if (!this._clientType || typeof(this._clientType) !== 'string') {
      this._clientType = common.CONST.DEFAULT_CLIENT_TYPE;
    } else {
      this._clientType = this._clientType.toLowerCase();
    }

    // Do a little extra for https
    if (this._clientType === 'https') {
        //sanity check
        if (typeof(settings.key) !== 'string' ||
            typeof(settings.cert) !== 'string' ||
            typeof(settings.ca) !== 'string' ||
            typeof(settings.rejectUnauthorized) !== 'boolean') {
              throw new Error('HTTPS Settings are required when clientType == https');
        }
        this._options.key = fs.readFileSync(settings.key);
        this._options.cert = fs.readFileSync(settings.cert);
        this._options.ca = fs.readFileSync(settings.ca);
        this._options.rejectUnauthorized = settings.rejectUnauthorized;
        this._options.strictSSL = false;
    }

    this._options.port = common.CONST.DEFAULT_PORT;
    if (!isNaN(settings.port)) {
      this._options.port = settings.port;
    }
    this._options.host = common.CONST.DEFAULT_HOST;
    if (typeof(settings.host) === 'string') {
      this._options.host = settings.host;
    }

    // Auth
    if (typeof(settings.auth) === 'string') {
      if (settings.auth.split(':').length < 2) {
        throw new Error('Authentication definition is invalid');
      }
      this._options.auth = settings.auth;
    }

    // Compression
    if (settings.compression) {
      if (settings.compression === common.CONST.ENC_GZIP ||
          settings.compression === common.CONST.ENC_DEFLATE) {
        this._compression = settings.compression;
        this._options.headers['Content-Encoding'] = this._compression;
      } else {
        throw new Error('Invalid compression: ' + settings.compression);
      }
    }

    // Get timeout
    this._timeout = isNaN(settings.timeout) ? 0 : settings.timeout;

    // Max length of messages contents to log
    this._maxLenMsgLog = settings.maxLenMsgLog;
    if (isNaN(this._maxLenMsgLog)) {
      this._maxLenMsgLog = common.CONST.DEFAULT_MAX_LEN_MSG_LOG;
    }

    //finally setup the agent
    this._options.keepAlive = settings.keepAlive === false ? false : true;
    this._options.maxSockets = isNaN(settings.maxSockets) ? undefined : settings.maxSockets;

    if (this._clientType === 'https') {
      this._options.agent = new https.Agent(this._options);
    } else {
      this._options.agent = new http.Agent(this._options);
    }

    // Info about connection
    if (this._log && this._log.isInfo()) {
      this._log.info('Client type: ' + this._clientType);
      this._log.info('Client options: ' +  JSON.stringify(this._options, null, '  '));
    }

  }

  /**
   * Log full and actual length of write data
   * @param {number} fullLen
   * @param {number} actLen
   */
  _logWrite(fullLen, actLen) {
    let len;
    if (this._compression) {
      len = actLen;
    } else {
      len = fullLen;
    }
    if (this._log && this._log.isDebug()) {
      this._log.debug('Write data (enc: "%s"), act=%d/full=%d bytes',
                      this._compression, len, fullLen);
    }
  }
}


// Exports
module.exports = JsonRestClient;
