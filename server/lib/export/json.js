const dbHelper = require('../database_helper.js');

module.exports = {
    generateExport: (cb) => {
        let dataSet = dbHelper.getAllDataSetsWithData();

        if (dataSet) {
            cb(null, {
                contentType: 'application/json',
                file: JSON.stringify(dataSet, null, 4),
                fileSuffix: 'json'
            });
        } else {
            cb({
                message: 'got an empty data set',
                status: 'error'
            }, null);
        }
    }
};