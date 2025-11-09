const chai = require('chai');
const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');

const apiUrl = '/api/v1';

const testHelper = require('../_initializeSetup.cjs');
testHelper.init();

describe('Image Generator', () => {
    it('generate placeholder image with defaults', (done) => {
        chai.request(testHelper.getServer())
            .post(`${apiUrl}/generate-image`)
            .send({})
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('imageUrl');
                res.body.should.have.property('message').eql('Image generated successfully');
                res.body.should.have.property('details');
                res.body.details.should.have.property('width').eql(800);
                res.body.details.should.have.property('height').eql(600);
                res.body.details.should.have.property('text').eql('Placeholder');
                res.body.details.should.have.property('format').eql('jpeg');
                
                // Verify image file was created
                const imagePath = res.body.imageUrl.replace('/data', '');
                const fullPath = `${process.env.STJORNA_SERVER_STORAGE}${imagePath}`;
                expect(fs.existsSync(fullPath)).to.be.true;
                
                done();
            });
    });

    it('generate placeholder image with custom parameters', (done) => {
        chai.request(testHelper.getServer())
            .post(`${apiUrl}/generate-image`)
            .send({
                width: 400,
                height: 300,
                text: 'Test Product',
                backgroundColor: '#ff0000',
                textColor: '#ffffff',
                format: 'png',
                category: 'categories'
            })
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('imageUrl');
                res.body.details.should.have.property('width').eql(400);
                res.body.details.should.have.property('height').eql(300);
                res.body.details.should.have.property('text').eql('Test Product');
                res.body.details.should.have.property('format').eql('png');
                res.body.details.should.have.property('category').eql('categories');
                
                // Verify image file was created
                const imagePath = res.body.imageUrl.replace('/data', '');
                const fullPath = `${process.env.STJORNA_SERVER_STORAGE}${imagePath}`;
                expect(fs.existsSync(fullPath)).to.be.true;
                
                done();
            });
    });

    it('reject image with invalid width', (done) => {
        chai.request(testHelper.getServer())
            .post(`${apiUrl}/generate-image`)
            .send({
                width: 5000, // exceeds max of 4000
                height: 600
            })
            .end((err, res) => {
                res.should.have.status(400);
                res.body.should.have.property('message').that.includes('Width must be between 1 and 4000');
                res.body.should.have.property('status').eql('error');
                done();
            });
    });

    it('reject image with invalid height', (done) => {
        chai.request(testHelper.getServer())
            .post(`${apiUrl}/generate-image`)
            .send({
                width: 800,
                height: 5000 // exceeds max of 4000
            })
            .end((err, res) => {
                res.should.have.status(400);
                res.body.should.have.property('message').that.includes('Height must be between 1 and 4000');
                res.body.should.have.property('status').eql('error');
                done();
            });
    });

    it('reject image with invalid format', (done) => {
        chai.request(testHelper.getServer())
            .post(`${apiUrl}/generate-image`)
            .send({
                width: 800,
                height: 600,
                format: 'gif' // not supported
            })
            .end((err, res) => {
                res.should.have.status(400);
                res.body.should.have.property('message').that.includes('Format must be either jpeg or png');
                res.body.should.have.property('status').eql('error');
                done();
            });
    });
});
