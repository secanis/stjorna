const Datastore = require('nedb');

module.exports = {
    db_categories: new Datastore({ filename: `${process.env.STJORNA_SERVER_STORAGE}/categories.db`, autoload: true, inMemoryOnly: false }),
    db_products: new Datastore({ filename: `${process.env.STJORNA_SERVER_STORAGE}/products.db`, autoload: true, inMemoryOnly: false }),
    db_users: new Datastore({ filename: `${process.env.STJORNA_SERVER_STORAGE}/users.db`, autoload: true, inMemoryOnly: false }),
    db_session: new Datastore({ inMemoryOnly: true }),
    initialize: (log) => {
        // initialize constellation
        module.exports.db_categories.count({}, (err, count) => {
            log.inf(`>> constellation.categories    ${count}      records stored.`);
        });
        module.exports.db_products.count({}, (err, count) => {
            log.inf(`>> constellation.products      ${count}      records stored.`);
        });
        module.exports.db_users.count({}, (err, count) => {
            log.inf(`>> constellation.users         ${count}      records stored.`);
        });
    }
};