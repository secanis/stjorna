const expect = require('chai').expect;

const loggingHelper = require('../../lib/logging_helper.cjs');

const testHelper = require('../_initializeSetup.cjs');
testHelper.init();

const timestampNow = new Date().toUTCString();

describe('Logging', () => {
    it('application log format', () => {
        const info = {
            message: 'dummyComponent - dummyTestMesage',
            level: 'warn',
            label: 'stjrona',
            timestamp: timestampNow
        };

        const result = loggingHelper._buildStjornaLogFormat(info);

        result.should.be.a('string');
        expect(result).to.be.equal(`${timestampNow} [stjrona] [warn] [dummyComponent] dummyTestMesage`, 'application log');
    });

    it('request log format', () => {
        const info = {
            message: 'POST /foo/bar/url?with=params',
            level: 'warn',
            label: 'stjorna-req',
            timestamp: timestampNow
        };

        const result = loggingHelper._buildStjornaRequestLogFormat(info);

        result.should.be.a('string');
        expect(result).to.be.equal(`${timestampNow} [stjorna-req] POST /foo/bar/url?with=params`, 'request log');
    });

    it('check slient logs', () => {
        let result = loggingHelper._isSlientLogActivated('application');
        result.should.be.a('boolean');
        expect(result).to.be.equal(true, 'slient application log');

        result = loggingHelper._isSlientLogActivated('request');
        result.should.be.a('boolean');
        expect(result).to.be.equal(true, 'slient request log');

        result = loggingHelper._isSlientLogActivated('dummy');
        result.should.be.a('boolean');
        expect(result).to.be.equal(false, 'dummy param slient log');

        result = loggingHelper._isSlientLogActivated();
        result.should.be.a('boolean');
        expect(result).to.be.equal(false, 'empty param slient log');
    });
});
