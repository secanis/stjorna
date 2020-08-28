const CronJob = require('cron').CronJob;
const fileHelper = require('../lib/file_helper.js');
const { writeCronInfo } = require('../lib/file_helper.js');

const logger = require('../lib/logging_helper.js').logger;


module.exports = () => {
    let cronJob;
    const tickFunc = () => {
        fileHelper.getFolderContent(`${process.env.STJORNA_SERVER_STORAGE}/uploads`, (err, users) => {
            if (!err) {
                users.forEach((user) => {
                    // product loop
                    const productsPath = `${process.env.STJORNA_SERVER_STORAGE}/uploads/${user.name}/products`;
                    generateFiles(productsPath)

                    // category loop
                    const categoriesPath = `${process.env.STJORNA_SERVER_STORAGE}/uploads/${user.name}/categories`;
                    generateFiles(categoriesPath)
                });

                writeCronInfo('Thumbnail Generator', cronJob.lastDate(), cronJob.nextDate().toDate());
            }
        });
    };

    const generateFiles = (path) => {
        fileHelper.getFolderContent(path, (err, files) => {
            if (!err) {
                try {
                    files.filter(f => !f.name.includes('.thumbnail') && !f.name.includes('.webp')).forEach(f => {
                        fileHelper.generateImageTypeWebP(path, f);
                        fileHelper.generateImageThumbnails(path, f);
                    });
                } catch (error) {
                    console.error(error);
                }
            } else {
                logger.error(`cronjob - thumnail generator - walk uploads failed: ${err.message}`);
            }
        });
    }


    setTimeout(() => {
        // run thumbnail generation cronjob every x minutes
        cronJob = new CronJob({
            cronTime: process.env.STJORNA_CRON_THUMBNAIL_INTERVAL,
            onTick: tickFunc,
            runOnInit: true
        });

        logger.info(`cronjob - thumbnail generator is running`);
        cronJob.start();
    }, 1000);
};