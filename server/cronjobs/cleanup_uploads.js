const CronJob = require('cron').CronJob;
const dbHelper = require('../lib/database_helper.js');
const fileHelper = require('../lib/file_helper.js');
const { writeCronInfo } = require('../lib/cronjob_helper.js');

const logger = require('../lib/logging_helper.js').logger;

module.exports = () => {
    let cronJob;
    function tickFunc() {
        fileHelper.getFolderContent(`${process.env.STJORNA_SERVER_STORAGE}/uploads`, (err, users) => {
            if (!err) {
                users.forEach((user) => {
                    // product cleanup
                    let productsPath = `${process.env.STJORNA_SERVER_STORAGE}/uploads/${user.name}/products`;
                    cleanupFunc(productsPath, 'products');

                    // category cleanup
                    let categoriesPath = `${process.env.STJORNA_SERVER_STORAGE}/uploads/${user.name}/categories`;
                    cleanupFunc(categoriesPath, 'categories');
                });
            }
            writeCronInfo('Cleanup Uploads', this.lastDate(), this.nextDate().toDate())
        });
    }

    function cleanupFunc(path, type) {
        fileHelper.getFolderContent(path, (err, files) => {
            if (!err) {
                const elements = dbHelper.db.get(type).value();
                if (elements) {
                    fileHelper.matchFileWithListOfObjects(path, files, elements, 'imageUrl', true);
                } else {
                    logger.error(`cron - cleanup_uploads - load ${type} failed: ${err.message}`);
                }
            } else {
                logger.error(`cron - cleanup_uploads - walk uploads failed: ${err.message}`);
            }
        });
    }


    // run cleanup cronjob every x minutes
    cronJob = new CronJob({
        cronTime: process.env.STJORNA_CRON_CLEANUP_INTERVAL,
        timeZone: 'Europe/Zurich',
        onTick: tickFunc,
        runOnInit: true
    });

    logger.info(`cron - cleanup uploads is registred`);
    setTimeout(_ => {
        cronJob.start();
    }, 1000);
};