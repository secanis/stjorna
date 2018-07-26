let chai = require('chai');
let chaiHttp = require('chai-http');
let server;
let should = chai.should();
let rimraf = require('rimraf');

const dbHelper = require('../lib/database_helper.js');

let apiUrl = '/api/v1';

process.env.NODE_ENV = 'test';
process.env.STJORNA_SECURITY = 'none';
process.env.STJORNA_LOGLEVEL = 'error';
process.env.STJORNACONFIG_IMAGE_DIMENSION = 255;
process.env.STJORNACONFIG_IMAGE_QUALITY = 50;
process.env.STJORNACONFIG_PASSWORD_SECRECT = 'testpwsecret';
process.env.STJORNA_SERVER_STORAGE = `${process.cwd()}/data`;

const user = {
    username: 'admin',
    email: 'admin@domain.com',
    password: 'admin4test'
};

const config = {
    image_dimension: process.env.STJORNACONFIG_IMAGE_DIMENSION - 0,
    image_quality: process.env.STJORNACONFIG_IMAGE_QUALITY - 0,
    allow_remote_access: true
};

chai.use(chaiHttp);

before((done) => {
    server = require('../server.js');

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
                        user: user
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
        } catch {}
    }, 100);
});

after((done) => {
    rimraf(`${process.env.STJORNA_SERVER_STORAGE}`, () => {
        console.info('\n> stjorna test: deleting data folder done');
        done();
    });
});