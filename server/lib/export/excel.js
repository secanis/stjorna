const path = require('path');
const fs = require('fs');
var xl = require('excel4node');

const dbHelper = require('../database_helper.js');

module.exports = {
    generateExport: (cb) => {
        let dataSet = dbHelper.getAllDataSets();

        if (dataSet) {
            // build excel file
            let wb = new xl.Workbook({
                dateFormat: 'dd.mm.yyyy hh:mm:ss',
                author: 'Stjorna by secanis.ch'
            });

            let ws_categories = wb.addWorksheet('categories');
            let ws_products = wb.addWorksheet('products');
            let ws_users = wb.addWorksheet('users');
            try {
                // fill categories into ws
                // get all keys
                let categoryKeys = Object.keys(dataSet.categories[0]);
                // iterate over the keys and print the title line
                categoryKeys.forEach((title, i) => {
                    ws_categories.cell(1, i + 1).string(title);
                });
                // iterate over all data items
                dataSet.categories.forEach((c, i) => {
                    // iterate over all title items to generate dynamically all items per row
                    categoryKeys.forEach((title, j) => {
                        // check if we have some data, if not, set it to an empty string
                        if (c[title]) {
                            ws_categories.cell(i + 2, j + 1).string(c[title].toString());
                        } else {
                            ws_categories.cell(i + 2, j + 1).string('');
                        }
                    });
                });

                // fill products into ws
                let productKeys = Object.keys(dataSet.products[0]);
                productKeys.forEach((title, i) => {
                    ws_products.cell(1, i + 1).string(title);
                });
                dataSet.products.forEach((c, i) => {
                    productKeys.forEach((title, j) => {
                        if (c[title]) {
                            ws_products.cell(i + 2, j + 1).string(c[title].toString());
                        } else {
                            ws_products.cell(i + 2, j + 1).string('');
                        }
                    });
                });

                // fill users into ws
                let userKeys = Object.keys(dataSet.users[0]);
                userKeys.forEach((title, i) => {
                    ws_users.cell(1, i + 1).string(title);
                });
                dataSet.users.forEach((c, i) => {
                    userKeys.forEach((title, j) => {
                        if (c[title]) {
                            ws_users.cell(i + 2, j + 1).string(c[title].toString());
                        } else {
                            ws_users.cell(i + 2, j + 1).string('');
                        }
                    });
                });
            } catch (e) {
                cb(e, null);
            } finally {
                wb.writeToBuffer().then(buffer => {
                    cb(null, {
                        contentType: 'application/vnd.ms-excel',
                        file: buffer,
                        fileSuffix: 'xlsx'
                    });
                });
            }
        } else {
            cb({
                message: 'got an empty data set'
            }, null);
        }
    }
};