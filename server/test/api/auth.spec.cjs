const chai = require('chai');
const expect = require('chai').expect;

const apiUrl = '/api/v1';

const testHelper = require('../_initializeSetup.cjs');
testHelper.init();

describe('Authentication', () => {
    it('with body token', (done) => {
        chai.request(testHelper.getServer())
            .post(`${apiUrl}/authenticate`)
            .send(testHelper.getDefaultUser())
            .end((err, res) => {
                res.should.have.status(200);
                expect(err).to.be.null;
                const userLogin = res.body;
                userLogin.should.be.a('object');
                userLogin.should.have.property('email').eql(testHelper.getDefaultUser().email);
                userLogin.should.have.property('username').eql(testHelper.getDefaultUser().username);
                userLogin.should.have.property('message').eql('have fun and enjoy life...');
                userLogin.should.have.property('status').eql('successful');
                userLogin.should.have.property('_id');
                userLogin.should.have.property('token');
                // verify login
                chai.request(testHelper.getServer())
                    .post(`${apiUrl}/authenticate/verify`)
                    .send({
                        token: userLogin.token
                    })
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.should.have.property('status').eql('info');
                        res.body.should.have.property('message').eql('your token is vaild.');
                        done();
                    });
            });
    });

    it('with query token', (done) => {
        chai.request(testHelper.getServer())
            .post(`${apiUrl}/authenticate`)
            .send(testHelper.getDefaultUser())
            .end((err, res) => {
                res.should.have.status(200);
                expect(err).to.be.null;
                const userLogin = res.body;
                userLogin.should.be.a('object');
                userLogin.should.have.property('email').eql(testHelper.getDefaultUser().email);
                userLogin.should.have.property('username').eql(testHelper.getDefaultUser().username);
                userLogin.should.have.property('message').eql('have fun and enjoy life...');
                userLogin.should.have.property('status').eql('successful');
                userLogin.should.have.property('_id');
                userLogin.should.have.property('token');
                // verify login
                chai.request(testHelper.getServer())
                    .post(`${apiUrl}/authenticate/verify?token=${userLogin.token}`)
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.should.have.property('status').eql('info');
                        res.body.should.have.property('message').eql('your token is vaild.');
                        done();
                    });
            });
    });

    it('with header token', (done) => {
        chai.request(testHelper.getServer())
            .post(`${apiUrl}/authenticate`)
            .send(testHelper.getDefaultUser())
            .end((err, res) => {
                res.should.have.status(200);
                expect(err).to.be.null;
                const userLogin = res.body;
                userLogin.should.be.a('object');
                userLogin.should.have.property('email').eql(testHelper.getDefaultUser().email);
                userLogin.should.have.property('username').eql(testHelper.getDefaultUser().username);
                userLogin.should.have.property('message').eql('have fun and enjoy life...');
                userLogin.should.have.property('status').eql('successful');
                userLogin.should.have.property('_id');
                userLogin.should.have.property('token');
                // verify login
                chai.request(testHelper.getServer())
                    .post(`${apiUrl}/authenticate/verify`)
                    .set('x-stjorna-access-token', userLogin.token)
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.should.have.property('status').eql('info');
                        res.body.should.have.property('message').eql('your token is vaild.');
                        done();
                    });
            });
    });

    it('bad auth creds - wrong password', (done) => {
        let userObj = testHelper.getDefaultUser();
        userObj.password = 'dummyPassword';
        chai.request(testHelper.getServer())
            .post(`${apiUrl}/authenticate`)
            .send(userObj)
            .end((err, res) => {
                expect(err).to.be.null;
                res.should.have.status(401);
                res.body.should.be.a('object');
                res.body.should.have.property('username').eql(testHelper.getDefaultUser().username);
                res.body.should.have.property('message').eql('E101: invalid login credentials');
                res.body.should.have.property('status').eql('failed');
                done();
            });
    });

    it('bad auth creds - emtpy object', (done) => {
        let userObj = testHelper.getDefaultUser();
        userObj.password = '';
        userObj.username = '';
        chai.request(testHelper.getServer())
            .post(`${apiUrl}/authenticate`)
            .send(userObj)
            .end((err, res) => {
                expect(err).to.be.null;
                res.should.have.status(401);
                res.body.should.be.a('object');
                res.body.should.have.property('username').eql('');
                res.body.should.have.property('message').eql('E101: invalid login credentials');
                res.body.should.have.property('status').eql('failed');
                done();
            });
    });
});
