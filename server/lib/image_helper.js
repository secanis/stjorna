const crypto = require('crypto');
const Jimp = require("jimp");

const fileHelper = require('../lib/file_helper.js');

module.exports = {
    prepareAndSaveImage: (base64Image, additionalPath, userid) => {
        // remove base64 identifier
        let data = base64Image.replace('data:image/jpeg;base64,', '');
        // write data into buffer
        let buff = new Buffer.from(data, 'base64');
        // generate new hash for imagename
        let hash = crypto.createHash('sha1').update(`${data}-${new Date().getTime()}`, 'utf8').digest('hex');
        let imagePath = `/data/uploads/${userid}${additionalPath}/${hash}.jpeg`;
        fileHelper.loadConfigFile((err, config) => {
            if (!err) {
                config = JSON.parse(config);
                // resize and set the quality for the image and save it
                Jimp.read(buff).then((image) => {
                    image.resize(config.image_dimension, config.image_dimension)
                        .quality(config.image_quality)
                        .write(`${__dirname}/..${imagePath}`, (err) => {
                            if (err) {
                                console.error(`error occured while writing image to filesystem: ${err.message}`);
                            }
                        });
                }).catch((err) => {
                    console.error(`error occured while reading image buffer: ${err.message}`);
                    res.status(500).send({ "error": err.message, "status": "error" });
                });
            } else {
                console.error(`error occured while writing image to filesystem: ${err.message}`);
                res.status(500).send({ "error": err.message, "status": "error" });
            }
        });
        return imagePath;
    }
};
