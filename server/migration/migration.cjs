const path = require('path');
const fs = require('fs');
const logger = require('../lib/logging_helper.cjs').logger;

const directoryPath = path.join(__dirname, '');

function executeMigrations() {
    try {
        const configFile = fs.readFileSync(`${process.env.STJORNA_SERVER_STORAGE}/config.json`);
        if (JSON.parse(configFile).installed) {
            logger.info(`execute migration for folder: ${directoryPath}`);
            const files = fs.readdirSync(directoryPath);
            files
                .filter(file => file !== 'migration.js' && file.endsWith('.cjs'))
                .some(file => {
                    logger.debug(`  execute migration: ${file.replace(/(\.[a-zA-Z0-9]+)/, '')}`);
                    require(path.join(__dirname + `/${file}`));
                });
        } else {
            logger.warn('can not execute migration, STJORNA is not yet installed');
        }
    } catch (ex) {
        logger.debug('can not execute migration, STJORNA is not yet installed');
    }
}

module.exports = {
    executeMigrations
};
