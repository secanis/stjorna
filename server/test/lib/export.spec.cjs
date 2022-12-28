const expect = require('chai').expect;
const exportJson = require('../../lib/export/json.cjs');
const exportExcel = require('../../lib/export/excel.cjs');
const dbHelper = require('../../lib/database_helper.cjs');

const testHelper = require('../_initializeSetup.cjs');
testHelper.init();

describe('Export', () => {
    it('generate json', (done) => {
        exportJson.generateExport((err, result) => {
            expect(err).to.be.null;
            result.should.be.a('object');
            result.should.have.property('contentType').eql('application/json');
            result.should.have.property('file');
            result.should.have.property('fileSuffix').eql('json');
            done();
        });
    });

    it('generate excel - bad case', (done) => {
        dbHelper.getAllDataSetsWithData = () => {
            return {
                categories: [],
                products: [],
                users: []
            };
        };

        exportExcel.generateExport((err, result) => {
            expect(result).to.be.null;
            err.should.be.a('object');
            err.should.have.property('message').eql('got an empty data set');
            err.should.have.property('status').eql('error');
            done();
        });
    });

    it('generate excel', (done) => {
        const ids = testHelper.generateIds();
        dbHelper.getAllDataSetsWithData = () => {
            return {
                categories: [testHelper.generateCategoryObject(ids.userId, ids.categoryId)],
                products: [testHelper.generateProductObject(ids.userId, ids.categoryId, ids.productId)],
                users: [testHelper.generateUserObject(ids.userId)]
            };
        };

        exportExcel.generateExport((err, result) => {
            expect(err).to.be.null;
            result.should.be.a('object');
            result.should.have.property('contentType').eql('application/vnd.ms-excel');
            result.should.have.property('file');
            result.should.have.property('fileSuffix').eql('xlsx');
            done();
        });
    });
}).timeout(10000);
