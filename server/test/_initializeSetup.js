const chai = require('chai');
const chaiHttp = require('chai-http');
const should = chai.should();
const rimraf = require('rimraf');

const apiUrl = '/api/v1';
let server;
let dbHelper;

process.env.NODE_ENV = 'test';
process.env.STJORNA_SERVER_PORT = 9999;
process.env.STJORNA_SECURITY = 'none';
process.env.STJORNA_LOGLEVEL = 'slient';
process.env.STJORNA_REQUEST_LOG = 'slient';
process.env.STJORNACONFIG_IMAGE_WIDTH = 255;
process.env.STJORNACONFIG_IMAGE_HEIGHT = 255;
process.env.STJORNACONFIG_IMAGE_QUALITY = 50;
process.env.STJORNACONFIG_PASSWORD_SECRECT = 'testpwsecret';
process.env.STJORNA_SERVER_STORAGE = `${process.cwd()}/testdata`;

const init = () => {
    const config = {
        image: {
            width: process.env.STJORNACONFIG_IMAGE_WIDTH - 0,
            height: process.env.STJORNACONFIG_IMAGE_HEIGHT - 0,
            quality: process.env.STJORNACONFIG_IMAGE_QUALITY - 0
        },
        allow_remote_access: true
    };
    
    chai.use(chaiHttp);
    server = require('../server.js');
    dbHelper = require('../lib/database_helper.js');
    
    before((done) => {
        // wait for database
        let dbState;
        let iv = setInterval(() => {
            try {
                dbState = dbHelper.db.getState();
                if (dbState) {
                    clearInterval(iv);
                    chai.request(server)
                        .post(`${apiUrl}/setup`)
                        .send({
                            config: config,
                            user: getDefaultUser()
                        })
                        .end((err, res) => {
                            if (err) {
                                throw err;
                            }
                            res.should.have.status(200);
                            res.body.should.be.a('object');
                            res.body.message.config_status.errors.length.should.be.eql(0);
                            res.body.message.user_status.errors.length.should.be.eql(0);
                            done();
                        });
                }
            } catch(ex) {
                console.error(`couldn't start database/database connection.`)
            }
        }, 100);
    });
    
    after((done) => {
        rimraf(`${process.env.STJORNA_SERVER_STORAGE}`, () => {
            done();
        });
    });
}

// test helper methods
const getDefaultUser = () => {
    return {
        username: 'admin',
        email: 'admin@domain.com',
        password: 'admin4test'
    };
}

const generateIds = () => {
    return {
        userId: dbHelper.generateId(),
        categoryId: dbHelper.generateId(),
        productId: dbHelper.generateId()
    };
}

const generateUserObject = (userId) => {
    return {
        _id: userId,
        username: `dummyUsername-${userId}`,
        password: '',
        email: `${userId}@email.com`,
        apikey: '',
        language: 'en',
        created: new Date().getTime(),
        updated: new Date().getTime()
    };
}

const generateCategoryObject = (userId, categoryId) => {
    return {
        _id: categoryId,
        name: `dummyCategory-${categoryId}`,
        description: '',
        active: true,
        image: '',
        imageUrl: dbHelper.generateId(),
        created: new Date().getTime(),
        createdUser: userId,
        updated: new Date().getTime(),
        updatedUser: null
    };
}

const generateProductObject = (userId, categoryId, productId) => {
    return {
        _id: productId,
        name: `dummyProduct-${productId}`,
        category: categoryId,
        price: 34.2,
        description: '',
        active: true,
        image: '',
        imageUrl: '',
        created: new Date().getTime(),
        createdUser: userId,
        updated: new Date().getTime(),
        updatedUser: null
    };
};

const getServer = () => {
    return server;
}

const searchObjectByProperty = (arr, search, property)=> {
    let retVal = null;
    for (let i = 0; i < arr.length; i++) {
        let item = arr[i];
        if (item.hasOwnProperty(property)) {
            if (item[property].toLowerCase() === search.toLowerCase()) {
                return item;
            }
        }
    };
    return retVal;
};

module.exports = {
    init,
    getDefaultUser,
    generateIds,
    generateUserObject,
    generateProductObject,
    generateCategoryObject,
    getServer,
    searchObjectByProperty
};