const fs = require('fs');
const low = require('lowdb');
const FileAsync = require('lowdb/adapters/FileAsync');
const uniqid = require('uniqid');

const logger = require('../lib/logging_helper.js').logger;

if (!fs.existsSync(`${process.env.STJORNA_SERVER_STORAGE}`)) {
    fs.mkdirSync(`${process.env.STJORNA_SERVER_STORAGE}`);
}
const adapter = new FileAsync(`${process.env.STJORNA_SERVER_STORAGE}/database.json`);

// configured datasets for stjorna
const datasets = {
    categories: [],
    products: [],
    services: [],
    users: []
};

function generateId() {
    return uniqid();
}

function getAllDataSetMembers() {
    return Object.keys(datasets);
}

function getAllDataSets() {
    return datasets;
}

function getAllDataSetsWithData() {
    let result = JSON.parse(JSON.stringify(datasets));
    getAllDataSetMembers().forEach((constellation) => {
        result[constellation] = module.exports.db.get(constellation).value();
    });
    return result;
}

function getSizeOfDataSet(dataset) {
    let size;
    try {
        size = module.exports.db.get(dataset).size().value();
    } catch (err) {
        logger.error(`failed to get size of set '${dataset}', ${err.message}`);
    }
    return size;
}

function initializeLowDb(cb) {
    low(adapter).then(cb);
}

function initialize() {
    logger.info(`try to initialize configured database type: ${process.env.STJORNA_DATABASE_TYPE}`);
    switch (process.env.STJORNA_DATABASE_TYPE) {
        case 'lowdb':
            initializeLowDb((database) => {
                // initialize constellation
                module.exports.db = database;
                // set database defaults and print size of dataset
                module.exports.db.defaults(datasets).write().then(() => {
                    getAllDataSetMembers().forEach((constellation) => {
                        logger.info(`constellation.${constellation} records: ${getSizeOfDataSet(constellation)}`);
                    });
                });
            });
            break;
    
        default:
            logger.error(`could not initialize database. unkown database type set: ${process.env.STJORNA_DATABASE_TYPE}`);
            break;
    }
}

// export of all "public" database helper methods
module.exports = {
    db: null,
    initialize,
    generateId,
    getAllDataSets,
    getAllDataSetMembers,
    getAllDataSetsWithData,
    getSizeOfDataSet
};
