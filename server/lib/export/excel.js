const xl = require('excel4node');

const dbHelper = require('../database_helper.js');

module.exports = {
    generateExport: (cb) => {
        let dataSet = dbHelper.getAllDataSets();

        if (dataSet && dataSet.categories.length > 0 && dataSet.products.length > 0) {
            module.exports._excelGenerator(dataSet, cb);
        } else {
            cb({
                message: 'got an empty data set',
                status: 'error'
            }, null);
        }
    },
    _excelGenerator: (dataSet, cb) => {
        // build excel file
        let wb = new xl.Workbook({
            dateFormat: 'dd.mm.yyyy hh:mm:ss',
            author: 'Stjorna by secanis.ch'
        });

        let wsCategories = wb.addWorksheet('categories');
        let wsProducts = wb.addWorksheet('products');
        let wsUsers = wb.addWorksheet('users');
        try {
            // fill categories into ws
            // get all keys
            let categoryKeys = Object.keys(dataSet.categories[0]);
            // iterate over the keys and print the title line
            categoryKeys.forEach((title, i) => {
                wsCategories.cell(1, i + 1).string(title);
            });
            // iterate over all data items
            dataSet.categories.forEach((c, i) => {
                // iterate over all title items to generate dynamically all items per row
                categoryKeys.forEach((title, j) => {
                    // check if we have some data, if not, set it to an empty string
                    if (c[title]) {
                        wsCategories.cell(i + 2, j + 1).string(c[title].toString());
                    } else {
                        wsCategories.cell(i + 2, j + 1).string('');
                    }
                });
            });

            // fill products into ws
            let productKeys = Object.keys(dataSet.products[0]);
            productKeys.forEach((title, i) => {
                wsProducts.cell(1, i + 1).string(title);
            });
            dataSet.products.forEach((p, i) => {
                productKeys.forEach((title, j) => {
                    if (p[title]) {
                        wsProducts.cell(i + 2, j + 1).string(p[title].toString());
                    } else {
                        wsProducts.cell(i + 2, j + 1).string('');
                    }
                });
            });

            // fill users into ws
            let userKeys = Object.keys(dataSet.users[0]);
            userKeys.forEach((title, i) => {
                wsUsers.cell(1, i + 1).string(title);
            });
            dataSet.users.forEach((u, i) => {
                userKeys.forEach((title, j) => {
                    if (u[title]) {
                        wsUsers.cell(i + 2, j + 1).string(u[title].toString());
                    } else {
                        wsUsers.cell(i + 2, j + 1).string('');
                    }
                });
            });

            // write data to buffer and call cb
            wb.writeToBuffer().then((buffer) => {
                cb(null, {
                    contentType: 'application/vnd.ms-excel',
                    file: buffer,
                    fileSuffix: 'xlsx'
                });
            });
        } catch (e) {
            cb(e, null);
        }
    }
};