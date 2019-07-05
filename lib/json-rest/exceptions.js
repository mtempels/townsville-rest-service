/**
 * @fileOverview Exception definitions
 * @name exceptions.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Townsville.nl
 */

"use strict";

const util = require('util');

/**
 * To be thrown at a bad request
 * @param {string} message Message to display
 */
function BadRequest(message) {
    this.name = 'BadRequestError';
    this.message = message;
    this.stack = (new Error()).stack;
}
util.inherits(BadRequest, Error);
BadRequest.prototype.name = 'BadRequest';


/**
 * To be thrown if a not found error is applicable
 * @param {string} message Message to display
 */
function NotFound(message) {
    this.name = 'NotFoundError';
    this.message = message;
    this.stack = (new Error()).stack;
}
util.inherits(NotFound, Error);
BadRequest.prototype.name = 'NotFound';


/**
 * To be thrown at an internal server error
 * @param {string} message Message to display
 */
function InternalServerError(message) {
    this.name = 'BadRequestError';
    this.message = message;
    this.stack = (new Error()).stack;
}
util.inherits(InternalServerError, Error);
BadRequest.prototype.name = 'InternalServerError';


// Exports
module.exports.BadRequest = BadRequest;
module.exports.NotFound = NotFound;
module.exports.InternalServerError = InternalServerError;
