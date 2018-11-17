const chai = require('chai');

const apiUrl = '/api/v1';

const user_2 = {
    username: 'admin',
    email: 'admin@domain.com',
    password: 'admin4test',
    passwordNew: 'Fancy_New$Password!',
    passwordNewRepeat: 'Fancy_New$Password!'
};

const user_3 = {
    username: 'adminUserPut',
    email: 'admin@domain.com',
    password: 'admin4test'
};

const testHelper = require('../_initializeSetup.js');
testHelper.init();

describe('User/Auth', () => {
    it('update user', (done) => {
        chai.request(testHelper.getServer())
            .get(`${apiUrl}/users`)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('array');
                let userId = res.body[0]._id;
                chai.request(testHelper.getServer())
                    .post(`${apiUrl}/users/${userId}`)
                    .send(user_2)
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.should.have.property('_id').eql(userId);
                        res.body.should.have.property('username').eql(user_2.username);
                        done();
                    });
            });
    });

    it('auth user', (done) => {
        chai.request(testHelper.getServer())
            .put(`${apiUrl}/users`)
            .send(user_3)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id');
                res.body.should.have.property('username').eql(user_3.username);
                res.body.should.have.property('email').eql(user_3.email);
                chai.request(testHelper.getServer())
                    .post(`${apiUrl}/authenticate`)
                    .send(user_3)
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.should.have.property('status').eql('successful');
                        res.body.should.have.property('_id');
                        res.body.should.have.property('username').eql(user_3.username);
                        res.body.should.have.property('email').eql(user_3.email);
                        res.body.should.have.property('token');
                        done();
                    });
            });
    });
});
