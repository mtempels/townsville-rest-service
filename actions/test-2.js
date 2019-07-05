/**
 * @fileOverview test action 2
 * @name test-2.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Townsville.nl
 */
"use strict";

class action {
    
    constructor(settings) {
        //settings hold extra params you can provide in the config file for whatever youy need, api keys or whatever..
        console.log("action 2 is alive!");
    }

    process(data, cb) {
        // data holds the post-data that is sent to the route..
        data.result = "THIS IS ADDED IN TEST2!";
        cb(false, data);
    }
}

// Exports
module.exports = action;