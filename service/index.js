/**
 * @fileOverview Main service
 * @name index.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Townsville.nl
 */

"use strict";

const logger = require('townsville-logger');
const JSONRestServer = require('./json-rest-server');


/**
 * Main service class
 */
class Service {

  /**
   * Class constructor
   * @param {object} settings Service settings
   */
  constructor(settings) {

    this._init(settings);
  }

  /**
   * Run service
   */
  run() {
    if (this._jsonRestServer) {
      this._jsonRestServer.run();
    }
  }

  /**
   * Close service
   */
  close() {
    if (this._jsonRestServer) {
      this._jsonRestServer.close();
    }
  }

  // ---- Private ----

  /**
   * Init class
   * @param {object} settings Settings object
   * @throws {Error} If settings are bad
   */
  _init(settings) {

    // Sanity checks
    if (!settings) {
      throw new Error('Service requires a valid settings object');
    }
    this._log = logger.createLogger('service');

    // Setup json reset service
    this._jsonRestServer = new JSONRestServer(settings.jsonRest, settings.routes);

  }
}

// Exports
module.exports = Service;