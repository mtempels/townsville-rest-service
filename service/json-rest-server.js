/**
 * @fileOverview JSON Server class
 * @name https-rest-server.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Townsville.nl
 */


"use strict";

const jr = require('../lib/json-rest/json-rest');
const logger = require('townsville-logger');
const path = require('path');


class JSONRestServer {

  /**
   * Class constructor
   * @param {obj} settings Manager settings
   * @param {obj} settings routes
   * @throws {Error} On invalid settings
   */
  constructor(settings, routes) {
    this._init(settings, routes);
  }

  /**
   * Run Server
   */
  run() {
    this._json.run();
  }

  /**
   * Close Server
   */
  close() {
    if (this._json) {
      this._json.close();
    }
  }



  /**
   * Init Server
   * @param {object} settings
   * @param {object} cache
   */
  _init(settings, routes) {
    // Sanity checks
    if (!settings) {
      throw new Error('JSONRestServer requires a valid settings object');
    }

    if (!routes) {
      throw new Error('JSONRestServer requires a valid routes object');
    }

    this._log = logger.createLogger('json-rest-server');
    this._log.debug('JSON server options: ' + JSON.stringify(settings, null, '  '));

    // Create server
    this._json = new jr.JsonRestServer(settings, logger);
    // Add error handler
    this._json.on('error', (err) => {
      this._log.error(err);
    });

    routes.forEach(action => {
      this._json.addAction(action);
    });

  }

}

// Exports
module.exports = JSONRestServer;