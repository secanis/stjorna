const fs = require('fs');
const extract = require('extract-zip');

const logger = require('../logging_helper.cjs').logger;

module.exports = {
    unpackDatabase: async (source, target) => {
        logger.debug(`extract ${source}`);
        try {
            fs.unlink(`${process.env.STJORNA_SERVER_STORAGE}/database.json`, skipNotExistingFile);
            fs.unlink(`${process.env.STJORNA_SERVER_STORAGE}/config.json`, skipNotExistingFile);
            await extract(source, { dir: target });
            logger.info(`extraction complete ${source}`);
        } catch (err) {
            logger.error(`extraction failed ${err}`);
        }
    }
};

const skipNotExistingFile = (err) => {
    if (err && err.code == 'ENOENT') { return; };
};
