const CronJob = require('cron').CronJob;
const fileHelper = require('../lib/file_helper.js');
const { writeCronInfo } = require('../lib/cronjob_helper.js');

const logger = require('../lib/logging_helper.js').logger;


module.exports = () => {
    let cronJob;
    function tickFunc() {
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
            }
        });
        writeCronInfo('Thumbnail Generator', this.lastDate(), this.nextDate().toDate())
    };

    function generateFiles(path) {
        fileHelper.getFolderContent(path, (err, files) => {
            if (!err) {
                try {
                    files.filter(f => !f.name.includes('.thumbnail') && !f.name.includes('.webp')).forEach(f => {
                        fileHelper.generateImageTypeJpeg(path, f);
                        fileHelper.generateImageTypeWebP(path, f);
                    });
                } catch (error) {
                    console.error(error);
                }
            } else {
                logger.error(`cron - thumnail generator - walk uploads failed: ${err.message}`);
            }
        });
    }


    // run thumbnail generation cronjob every x minutes
    cronJob = new CronJob({
        cronTime: process.env.STJORNA_CRON_THUMBNAIL_INTERVAL,
        timeZone: 'Europe/Zurich',
        onTick: tickFunc,
        runOnInit: true
    });

    logger.info(`cron - thumbnail generator is registred`);
    cronJob.start();
};