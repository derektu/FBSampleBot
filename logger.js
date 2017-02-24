"use strict";

var log4js = require('log4js');

log4js.configure({
    appenders: [
        { type: 'console' }
    ]
});

// singleton instance
//
module.exports = exports = log4js;
