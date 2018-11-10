const fs = require('fs');
const low = require('lowdb');
const FileAsync = require('lowdb/adapters/FileAsync');
const uniqid = require('uniqid');

const logger = require('../lib/logging_helper.js').logger;

if (!fs.existsSync(`${process.env.STJORNA_SERVER_STORAGE}`)) {
    fs.mkdirSync(`${process.env.STJORNA_SERVER_STORAGE}`);
}
const adapter = new FileAsync(`${process.env.STJORNA_SERVER_STORAGE}/database.json`);

module.exports = {
    db: null,
    initialize: () => {
        low(adapter).then((database) => {
            // initialize constellation
            module.exports.db = database;
            module.exports.db.defaults({
                categories: [],
                products: [],
                users: []
            }).write().then(() => {
                logger.info(`>> constellation.categories records  |  ${module.exports.db.get('categories').size().value()}`);
                logger.info(`>> constellation.products records    |  ${module.exports.db.get('products').size().value()}`);
                logger.info(`>> constellation.users records       |  ${module.exports.db.get('users').size().value()}`);
            });
        });
    },
    generateId: () => {
        return uniqid();
    },
    getAllDataSets: () => {
        return {
            categories: module.exports.db.get('categories').value(),
            products: module.exports.db.get('products').value(),
            users: module.exports.db.get('users').value()
        };
    }
};
