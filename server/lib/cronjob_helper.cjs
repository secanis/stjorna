const dbHelper = require('./database_helper.cjs');

module.exports = {
    writeCronInfo: (name, last, next) => {
        const cronDB = dbHelper.db.get('cronjobs');
        const cronInfo = {
            name,
            last,
            next,
            timestamp: new Date(),
        };

        let cronItem = cronDB
            .find({ name });

        if (cronItem.value()) {
            cronItem.assign(cronInfo).write();
        } else {
            cronDB.push(cronInfo).write();
        }
    },
    getAllCronInfo: () => {
        const cronDB = dbHelper.db.get('cronjobs');
        return cronDB.value();
    }
};
