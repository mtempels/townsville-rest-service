/**
 * @fileOverview Main API entry point
 * @name index.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Townsville.nl
 */

"use strict";

const exceptions = require('./exceptions');
const JsonRestServer = require('./server');
const JsonRestClient = require('./client');


// Exports
module.exports.JsonRestServer = JsonRestServer;
module.exports.JsonRestClient = JsonRestClient;
module.exports.exceptions = exceptions;
