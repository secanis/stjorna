const crypto = require('crypto');
const Jimp = require("jimp");

const logger = require('./logging_helper.cjs').logger;
const fileHelper = require('./file_helper.cjs');

module.exports = {
    prepareAndSaveImage: (base64Image, additionalPath, userid) => {
        // remove base64 identifier
        let data = base64Image.replace('data:image/jpeg;base64,', '');
        // write data into buffer
        let buff = Buffer.from(data, 'base64');
        // generate new hash for imagename
        let hash = crypto.createHash('sha1').update(`${data}-${new Date().getTime()}`, 'utf8').digest('hex');
        let imagePath = `/uploads/${userid}${additionalPath}/${hash}.jpeg`;
        fileHelper.loadConfigFile((err, config) => {
            if (!err) {
                config = JSON.parse(config);
                // resize and set the quality for the image and save it
                Jimp.read(buff).then((image) => {
                    image.resize(config.image.width - 0, config.image.height - 0)
                        .quality(config.image.quality - 0)
                        .write(`${process.env.STJORNA_SERVER_STORAGE}/${imagePath}`, (err) => {
                            if (err) {
                                logger.error(`image - error occured while writing image to filesystem: ${err.message}`);
                            }
                        });
                }).catch((err) => {
                    logger.error(`image - error occured while reading image buffer: ${err.message}`);
                });
            } else {
                logger.error(`image - error occured while loading config file: ${err.message}`);
            }
        });
        // return api path to store in database
        return `/data${imagePath}`;
    }
};
