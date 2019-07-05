/**
 * @fileOverview Common to server and client
 * @name common.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Townsville.nl
 */

"use strict";

const util = require('util');


const CONST = {
  // Defaults
  DEFAULT_PORT: 80,
  DEFAULT_HOST: '0.0.0.0',
  DEFAULT_MAX_LEN_MSG_LOG: 50,
  DEFAULT_SERVER_TYPE: 'http',
  DEFAULT_CLIENT_TYPE: 'http',

  // Some used HTTP codes
  HTTP_OK: 200,
  HTTP_BAD_REQUEST: 400,
  HTTP_UNAUTHORIZED: 401,
  HTTP_NOT_FOUND: 404,
  HTTP_INTERNAL_SERVER_ERROR: 500,
  HTTP_SERVICE_UNAVAILABLE: 503,

  ENC_DEFLATE: 'deflate',
  ENC_DEFLATE_RAW: 'deflate_raw',  // Note this is not an official encoding type
  ENC_GZIP: 'gzip'
};


/**
 * Limit size of message to log
 * @param {Object} msg Message to log
 * @param {number} size Optional size limit
 * @returns {string} Limited message
 */
function limitedLogMsg(msg, size) {
  if (isNaN(size)) {
    size = CONST.DEFAULT_MAX_LEN_MSG_LOG;
  }

  if (typeof(msg) !== 'string') {
    msg = JSON.stringify(msg);
  }

  if (msg.length <= size) {
    return msg;
  }
  return msg.substring(0, size) + util.format('...(%d chars)', msg.length);
}


// Exports
module.exports.CONST = CONST;
module.exports.limitedLogMsg = limitedLogMsg;
