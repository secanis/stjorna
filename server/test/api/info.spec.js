const chai = require('chai');
const expect = require('chai').expect;

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
                res.body.should.have.property('api_port').eql(process.env.STJORNA_SERVER_PORT);
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

                let obj = testHelper.searchObjectByProperty(res.body, 'STJORNA_CRON_CLEANUP_INTERVAL', 'name');
                expect(obj.value).to.be.equal('00 3 * * *', 'check STJORNA_CRON_CLEANUP_INTERVAL env');

                obj = testHelper.searchObjectByProperty(res.body, 'STJORNA_LOGLEVEL', 'name');
                expect(obj.value).to.be.equal('slient', 'check STJORNA_LOGLEVEL env');

                // security is just during tests set to 'none', per default this ENV is not set
                obj = testHelper.searchObjectByProperty(res.body, 'STJORNA_SECURITY', 'name');
                expect(obj.value).to.be.equal('none', 'check STJORNA_SECURITY env');

                obj = testHelper.searchObjectByProperty(res.body, 'STJORNA_SERVER_STORAGE', 'name');
                expect(obj.value).to.be.equal(process.env.STJORNA_SERVER_STORAGE, 'check STJORNA_SERVER_STORAGE env');

                done();
            });
    });
});
