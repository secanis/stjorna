const logger = require('../lib/logging_helper.js').logger;

module.exports = {
    io: null,
    initalize: (http) => {
        module.exports.io = require('socket.io')(http);
        module.exports.io.on('verifyauth', (socket) => {
            // TODO verification
        });
    }
};
