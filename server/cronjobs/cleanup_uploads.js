const CronJob = require('cron').CronJob;
const dbHelper = require('../lib/database_helper.js');
const fileHelper = require('../lib/file_helper.js');

module.exports = (log) => {
    // run cleanup cronjob every x minutes
    new CronJob(process.env.STJORNA_CRON_CLEANUP_INTERVAL, () => {
        log.inf(`[CRON] cleanup_uploads is running`);

        fileHelper.getFolderContent(`${process.env.STJORNA_SERVER_STORAGE}/uploads`, (err, users) => {
            if (!err) {
                users.forEach(user => {
                    // product cleanup
                    let productsPath = `${process.env.STJORNA_SERVER_STORAGE}/uploads/${user.name}/products`;
                    fileHelper.getFolderContent(productsPath, (err, files) => {
                        if (!err) {
                            let products = dbHelper.db.get('products').value();
                            if (products) {
                                fileHelper.matchFileWithListOfObjects(productsPath, files, products, 'imageUrl', true);
                            } else {
                                log.err(`[CRON] cleanup_uploads - load products failed: ${err.message}`);
                            }
                        } else {
                            log.err(`[CRON] cleanup_uploads - walk uploads failed: ${err.message}`);
                        }
                    });

                    // category cleanup
                    let categoriesPath = `${process.env.STJORNA_SERVER_STORAGE}/uploads/${user.name}/categories`;
                    fileHelper.getFolderContent(categoriesPath, (err, files) => {
                        if (!err) {
                            let categories = dbHelper.db.get('categories').value();
                            if (categories) {
                                fileHelper.matchFileWithListOfObjects(categoriesPath, files, categories, 'imageUrl', true);
                            } else {
                                log.err(`[CRON] cleanup_uploads - load products failed: ${err.message}`);
                            }
                        } else {
                            log.err(`[CRON] cleanup_uploads - walk uploads failed: ${err.message}`);
                        }
                    });
                });
            }
        });
    }, null, true, 'Europe/Zurich');
}