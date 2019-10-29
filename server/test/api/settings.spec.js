const chai = require('chai');

const apiUrl = '/api/v1';

const config = {
    image: {
        width: process.env.STJORNACONFIG_IMAGE_WIDTH - 0,
        height: process.env.STJORNACONFIG_IMAGE_HEIGHT - 0,
        quality: process.env.STJORNACONFIG_IMAGE_QUALITY - 0
    },
    allow_remote_access: true
};

const testHelper = require('../_initializeSetup.js');
testHelper.init();

describe('Setup/Settings', () => {
    it('get setup status', (done) => {
        chai.request(testHelper.getServer())
            .get(`${apiUrl}/setup`)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('message').eql('installation status stjorna');
                res.body.should.have.property('image');
                res.body.image.should.have.property('width').eql(parseInt(config.image.width));
                res.body.image.should.have.property('height').eql(parseInt(config.image.height));
                res.body.image.should.have.property('quality').eql(parseInt(config.image.quality));
                done();
            });
    });

    it('get settings', (done) => {
        chai.request(testHelper.getServer())
            .get(`${apiUrl}/settings`)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('password_secret');
                res.body.should.have.property('allow_remote_access').eql(true);
                res.body.should.have.property('image');
                res.body.image.should.have.property('width').eql(parseInt(config.image.width));
                res.body.image.should.have.property('height').eql(parseInt(config.image.height));
                res.body.image.should.have.property('quality').eql(parseInt(config.image.quality));
                res.body.should.have.property('installed').eql(true);
                done();
            });
    });

    it('update settings', (done) => {
        chai.request(testHelper.getServer())
            .post(`${apiUrl}/settings`)
            .send({
                allow_remote_access: false
            })
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('message').eql('configuration successfully saved');
                chai.request(testHelper.getServer())
                    .get(`${apiUrl}/settings`)
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.should.have.property('password_secret');
                        res.body.should.have.property('allow_remote_access').eql(false);
                        res.body.should.have.property('image');
                        res.body.image.should.have.property('width').eql(parseInt(config.image.width));
                        res.body.image.should.have.property('height').eql(parseInt(config.image.height));
                        res.body.image.should.have.property('quality').eql(parseInt(config.image.quality));
                        res.body.should.have.property('installed').eql(true);
                        done();
                    });
            });
    });
});
