const fs = require('fs');
const low = require('lowdb');
const FileAsync = require('lowdb/adapters/FileAsync');
const uniqid = require('uniqid');

if (!fs.existsSync(`${process.env.STJORNA_SERVER_STORAGE}`)) {
    fs.mkdirSync(`${process.env.STJORNA_SERVER_STORAGE}`);
}
const adapter = new FileAsync(`${process.env.STJORNA_SERVER_STORAGE}/database.json`);

module.exports = {
    db: null,
    initialize: (log) => {
        low(adapter).then((database) => {
            // initialize constellation
            module.exports.db = database;
            module.exports.db.defaults({
                categories: [],
                products: [],
                users: []
            }).write().then(() => {
                log.inf(`>> constellation.categories records  |  ${module.exports.db.get('categories').size().value()}`);
                log.inf(`>> constellation.products records    |  ${module.exports.db.get('products').size().value()}`);
                log.inf(`>> constellation.users records       |  ${module.exports.db.get('users').size().value()}`);
            });
        });
    },
    generateId: () => {
        return uniqid();
    }
};
