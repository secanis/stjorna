const path = require('path');
const fs = require('fs');
const logger = require('../lib/logging_helper').logger;

const configFile = `${process.env.STJORNA_SERVER_STORAGE}/config.json`;

logger.debug('     load config file...');
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

logger.debug('     check if migration is required...');
if ((config.image_dimension && config.image_quality) && !config.image) {
    logger.debug('     migrate image configuration...');
    config['image'] = {
        width: config.image_dimension,
        height: config.image_dimension,
        quality: config.image_quality,
    }
    delete config.image_quality;
    delete config.image_dimension;

    fs.writeFileSync(configFile, JSON.stringify(config, null, 4), 'utf8');
    logger.info('     migration successfully executed');
} else {
    if (config.image && (config.image.quality && config.image.width && config.image.height)) {
        logger.debug('     no migration is required');
    } else {
        logger.warn('     could not execute the migration');
        logger.warn(`     please check your configfile ${configFile}, may have a look into the documentation`);
    }
}
