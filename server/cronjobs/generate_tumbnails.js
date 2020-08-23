const CronJob = require('cron').CronJob;
const dbHelper = require('../lib/database_helper.js');
const fileHelper = require('../lib/file_helper.js');

const logger = require('../lib/logging_helper.js').logger;


module.exports = () => {
    // run cleanup cronjob every x minutes
    let cronJob = new CronJob(process.env.STJORNA_CRON_THUMBNAIL_INTERVAL, () => {
        logger.info(`cronjob - thumnail generator is running`);

        fileHelper.getFolderContent(`${process.env.STJORNA_SERVER_STORAGE}/uploads`, (err, users) => {
            if (!err) {
                users.forEach((user) => {
                    // product loop
                    let productsPath = `${process.env.STJORNA_SERVER_STORAGE}/uploads/${user.name}/products`;
                    fileHelper.getFolderContent(productsPath, (err, files) => {
                        if (!err) {
                            try {
                                files.forEach(f => {
                                    if (!f.name.includes('.thumbnail') && !f.name.includes('.webp')) fileHelper.generateImageTypeWebP(productsPath, f);
                                    if (!f.name.includes('.thumbnail') && !f.name.includes('.webp')) fileHelper.generateImageThumbnails(productsPath, f);
                                });
                            } catch (error) {
                                console.error(error);
                            }
                        } else {
                            logger.error(`cronjob - thumnail generator - walk uploads failed: ${err.message}`);
                        }
                    });

                    // category loop
                    let categoriesPath = `${process.env.STJORNA_SERVER_STORAGE}/uploads/${user.name}/categories`;
                    fileHelper.getFolderContent(categoriesPath, (err, files) => {
                        if (!err) {
                            try {
                                files.forEach(f => {
                                    if (!f.name.includes('.thumbnail') && !f.name.includes('.webp')) fileHelper.generateImageTypeWebP(categoriesPath, f);
                                    if (!f.name.includes('.thumbnail') && !f.name.includes('.webp')) fileHelper.generateImageThumbnails(categoriesPath, f);
                                });
                            } catch (error) {
                                console.error(error);
                            }
                        } else {
                            logger.error(`cronjob - thumnail generator - walk uploads failed: ${err.message}`);
                        }
                    });
                });
            }
        });
    });
    cronJob.start({
        runOnInit: true
    });
};