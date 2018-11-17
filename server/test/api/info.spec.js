const chai = require('chai');
const app = require('../../package.json');

const apiUrl = '/api/v1';

const testHelper = require('../_initializeSetup.js');
testHelper.init();

describe('Info', () => {
    it('get server info', (done) => {
        chai.request(testHelper.getServer())
            .get(`${apiUrl}/info/server`)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('hostname');
                res.body.should.have.property('api_port').eql('3000');
                res.body.should.have.property('os');
                res.body.should.have.property('arch');
                res.body.should.have.property('mem_total');
                res.body.should.have.property('mem_free');
                res.body.should.have.property('cpu');
                res.body.should.have.property('loadavg');
                res.body.should.have.property('app_version').eql(`${app.name}:${app.version}`);
                done();
            });
    });

    it('get environment', (done) => {
        chai.request(testHelper.getServer())
            .get(`${apiUrl}/info/config`)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('array');
                res.body[0].should.have.property('name').eql('STJORNA_CRON_CLEANUP_INTERVAL');
                res.body[0].should.have.property('value').eql('00 3 * * *');
                res.body[1].should.have.property('name').eql('STJORNA_LOGLEVEL');
                // security is just during tests set to 'none', per default this ENV is not set
                res.body[2].should.have.property('name').eql('STJORNA_REQUEST_LOG');
                res.body[3].should.have.property('name').eql('STJORNA_SECURITY');
                res.body[3].should.have.property('value').eql('none');
                res.body[4].should.have.property('name').eql('STJORNA_SERVER_MAX_UPLOAD');
                res.body[4].should.have.property('value').eql('5mb');
                res.body[5].should.have.property('name').eql('STJORNA_SERVER_PORT');
                res.body[5].should.have.property('value').eql('3000');
                res.body[6].should.have.property('name').eql('STJORNA_SERVER_STORAGE');
                done();
            });
    });
});
