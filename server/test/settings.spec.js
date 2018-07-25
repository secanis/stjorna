process.env.STJORNA_LOGLEVEL = 'error';

let chai = require('chai');
let server = require('../server.js');

let apiUrl = '/api/v1';

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

require('./_initializeSetup.js');

describe('Setup/Settings', () => {
    it('get setup status', (done) => {
        chai.request(server)
            .get(`${apiUrl}/setup`)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('message').eql('installation status stjorna');
                res.body.should.have.property('image_dimension').eql(parseInt(config.image_dimension));
                res.body.should.have.property('image_quality').eql(parseInt(config.image_quality));
                done();
            });
    });

    it('get settings', (done) => {
        chai.request(server)
            .get(`${apiUrl}/settings`)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('password_secret');
                res.body.should.have.property('allow_remote_access').eql(true);
                res.body.should.have.property('image_dimension').eql(config.image_dimension);
                res.body.should.have.property('image_quality').eql(config.image_quality);
                res.body.should.have.property('installed').eql(true);
                done();
            });
    });

    it('update settings', (done) => {
        chai.request(server)
            .post(`${apiUrl}/settings`)
            .send({
                allow_remote_access: false
            })
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('message').eql('configuration successfully saved');
                chai.request(server)
                    .get(`${apiUrl}/settings`)
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.should.have.property('password_secret');
                        res.body.should.have.property('allow_remote_access').eql(false);
                        res.body.should.have.property('image_dimension').eql(config.image_dimension);
                        res.body.should.have.property('image_quality').eql(config.image_quality);
                        res.body.should.have.property('installed').eql(true);
                        done();
                    });
            });
    });
});
