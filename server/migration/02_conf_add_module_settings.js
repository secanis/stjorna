const path = require('path');
const fs = require('fs');
const logger = require('../lib/logging_helper').logger;

const configFile = `${process.env.STJORNA_SERVER_STORAGE}/config.json`;

logger.debug('     load config file...');
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

logger.debug('     check if migration is required...');
if (!config.modules) {
    logger.debug('     migrate modules configuration...');
    config['modules'] = {
        services: false,
    }

    fs.writeFileSync(configFile, JSON.stringify(config, null, 4), 'utf8');
    logger.info('     migration successfully executed');
} else {
    if (config.modules) {
        logger.debug('     no migration is required');
    } else {
        logger.warn('     could not execute the migration');
        logger.warn(`     please check your configfile ${configFile}, may have a look into the documentation`);
    }
}
