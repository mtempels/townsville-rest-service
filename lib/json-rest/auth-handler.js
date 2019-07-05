/**
 * @fileOverview Authentication handler (server side)
 * @name auth-handler.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Townsville.nl
 */

"use strict";

const auth = require('basic-auth');
const crypto = require('crypto');

class AuthHandler {

  constructor(settings, logger) {

    // If we have a logger, create a log instance
    if (logger instanceof Object) {
      this._log = logger.createLogger('auth-handler');
    }

    if (!settings) {
      throw new Error('AuthHandler requires settings');
    }
    if (typeof(settings.realm) !== 'string') {
      throw new Error('AuthHandler settings is missing the mandatory realm attribute');      
    }
    if (typeof(settings.users) !== 'object') {
      throw new Error('AuthHandler settings is missing authenticated users');
    }

    this._realm = settings.realm;
    this._users = settings.users;

    if (this._log) {
      this._log.debug(`Using basic authentication for realm '${this._realm}',` +
                      ` with ${Object.keys(this._users).length} known user(s)`);
    }
  }

  /**
   * Return if user is authorized
   * @param {Object} req HTTP request object
   * @returns {boolean} True when allowed
   */
  isAuthorized(req) {

    // Obtain credentials from request
    let credentials = auth(req);

    // No credentials
    if (!credentials) {
      return false;
    }
    // Unknown user
    let pwdHashRequired = this._users[credentials.name];
    if (!pwdHashRequired) {
      return false;
    }

    // Check pwdHashes
    let pwdHashActual = this._getPwdHash(credentials);
    return (pwdHashActual === pwdHashRequired);
  }

  /**
   * Obtain realm
   * @returns {} 
   */
  getRealm() {
    return this._realm;
  }

  // ---- Private ----

  /**
   * Obtain password hash using realm and credentials
   * @param {object} credentials Credentials object
   * @returns {string} Sha1 hash
   */
  _getPwdHash(credentials) {
    // Sanity check
    if (!credentials || !credentials.name || !credentials.pass) {
      return null;
    }
    
    let h = crypto.createHash('sha1');
    h.update(this._realm);
    h.update(credentials.name);
    h.update(credentials.pass);
    return h.digest('hex');
  }
  
}

module.exports = AuthHandler;
