const winston = require('winston');
const expressWinston = require('express-winston');

// set logging format for application logs
const stjornaLogFormat = winston.format.combine(
    winston.format.colorize({
        all: true
    }),
    winston.format.label({ label: 'stjorna' }),
    winston.format.timestamp(),
    winston.format.printf(info => {
        const padding = info.level.length <= 7 ? 7 : 17; 
        // detect component, if not write nothing
        let component = info.message.replace(/\s\-\s.*$/g, '');
        if (component !== info.message) {
            info.message = info.message.replace(`${component} - `, '');
            component = `[${component}] `;
        } else {
            component = '';
        }
        return `${info.timestamp} [${info.label}] [${info.level.padEnd(padding, '')}] ${component}${info.message}`;
    })
);

// set logging format for request logs
const stjornaRequestLogFormat = winston.format.combine(
    winston.format.colorize({
        all: true
    }),
    winston.format.label({ label: 'stjorna-req' }),
    winston.format.timestamp(),
    winston.format.printf(req => {
        return `${req.timestamp} [${req.label}] ${req.message}`;
    })
);

module.exports = {
    // classic logger configuration (console.log stuff)
    logger: winston.createLogger({
        level: process.env.STJORNA_LOGLEVEL,
        transports: [
            new (winston.transports.Console)({
                format: winston.format.combine(winston.format.colorize(), stjornaLogFormat)
            })
            // new winston.transports.File({ filename: 'combined.log' })
        ]
    }),
    // express logger configuration
    configureExpressLogging: expressWinston.logger({
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), stjornaRequestLogFormat)
            })
        ],
        level: (req, res) => {
            let level = '';
            if (res.statusCode >= 100) { level = 'info'; }
            if (res.statusCode >= 400) { level = 'warn'; }
            if (res.statusCode >= 500) { level = 'error'; }
            return level;
        },
        statusLevels: false,
        expressFormat: true
    })
};