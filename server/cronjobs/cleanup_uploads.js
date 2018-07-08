const CronJob = require('cron').CronJob;
const db_products = require('../lib/database_helper.js').db_products;
const db_categories = require('../lib/database_helper.js').db_categories;
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
                            db_products.find({}, (err, docs) => {
                                if (!err) {
                                    fileHelper.matchFileWithListOfObjects(productsPath, files, docs, 'imageUrl', true);
                                } else {
                                    log.err(`[CRON] cleanup_uploads - load products failed: ${err.message}`);
                                }
                            });
                        } else {
                            log.err(`[CRON] cleanup_uploads - walk uploads failed: ${err.message}`);
                        }
                    });

                    // category cleanup
                    let categoriesPath = `${process.env.STJORNA_SERVER_STORAGE}/uploads/${user.name}/categories`;
                    fileHelper.getFolderContent(categoriesPath, (err, files) => {
                        if (!err) {
                            db_categories.find({}, (err, docs) => {
                                if (!err) {
                                    fileHelper.matchFileWithListOfObjects(categoriesPath, files, docs, 'imageUrl', true);
                                } else {
                                    log.err(`[CRON] cleanup_uploads - load categories failed: ${err.message}`);
                                }
                            });
                        } else {
                            log.err(`[CRON] cleanup_uploads - walk uploads failed: ${err.message}`);
                        }
                    });
                });
            }
        });
    }, null, true, 'Europe/Zurich');
}