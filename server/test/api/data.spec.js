const chai = require('chai');

const apiUrl = '/api/v1';

const user = {
    username: 'admin',
    email: 'admin@domain.com',
    password: 'admin4test'
};

const product = {
    name: 'foo',
    category: 'catid',
    price: 30.5,
    description: 'nice foo product',
    active: true,
    image: '',
    imageUrl: '',
    createdUser: user.username
};

const product_2 = {
    name: 'bar',
    category: 'catid',
    price: 25.5,
    description: 'nice bar product',
    active: true,
    image: '',
    imageUrl: '',
    updatedUser: user.username
};

const category = {
    name: 'catFoo',
    description: 'nice catFoo category',
    active: false,
    image: '',
    imageUrl: '',
    createdUser: user.username
}

const category_2 = {
    name: 'catBar',
    description: 'nice catBar category',
    active: true,
    image: '',
    imageUrl: '',
    updatedUser: user.username
}

const exampleImage = 'data:image/jpeg;base64,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';

const testHelper = require('../_initializeSetup.js');
testHelper.init();

describe('Products/Categories', () => {
    it('get products', (done) => {
        chai.request(testHelper.getServer())
            .get(`${apiUrl}/products`)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('array');
                res.body.length.should.be.eql(0);
                done();
            });
    });

    // create, alter, get, delete product
    it('crud product', (done) => {
        let productId;
        chai.request(testHelper.getServer())
            .put(`${apiUrl}/products`)
            .send(product)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('name').eql(product.name);
                res.body.should.have.property('price').eql(product.price);
                res.body.should.have.property('category').eql(product.category);
                res.body.should.have.property('description').eql(product.description);
                res.body.should.have.property('active').eql(product.active);
                res.body.should.have.property('createdUser').eql(user.username);
                res.body.should.have.property('updatedUser').eql(null);
                res.body.should.have.property('created');
                res.body.should.have.property('updated');
                productId = res.body._id;
                chai.request(testHelper.getServer())
                    .post(`${apiUrl}/products/${productId}`)
                    .send(product_2)
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.should.have.property('_id').eql(productId);
                        chai.request(testHelper.getServer())
                            .get(`${apiUrl}/products/${productId}`)
                            .end((err, res) => {
                                res.body.should.have.property('name').eql(product_2.name);
                                res.body.should.have.property('price').eql(product_2.price);
                                res.body.should.have.property('category').eql(product_2.category);
                                res.body.should.have.property('description').eql(product_2.description);
                                res.body.should.have.property('active').eql(product_2.active);
                                res.body.should.have.property('createdUser').eql(user.username);
                                res.body.should.have.property('updatedUser').eql(user.username)
                                res.body.should.have.property('created');
                                res.body.should.have.property('updated');
                                chai.request(testHelper.getServer())
                                    .delete(`${apiUrl}/products/${productId}`)
                                    .end((err, res) => {
                                        res.should.have.status(200);
                                        res.body.should.be.a('object');
                                        res.body.should.have.property('message').eql('successfully removed');
                                        done();
                                    });
                            });
                    });
            });
    });

    it('get categories', (done) => {
        chai.request(testHelper.getServer())
            .get(`${apiUrl}/categories`)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('array');
                res.body.length.should.be.eql(0);
                done();
            });
    });

    // create, alter, get, delete category
    it('crud category', (done) => {
        let categoryId;
        chai.request(testHelper.getServer())
            .put(`${apiUrl}/categories`)
            .send(category)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('name').eql(category.name);
                res.body.should.have.property('description').eql(category.description);
                res.body.should.have.property('active').eql(category.active);
                res.body.should.have.property('createdUser').eql(user.username);
                res.body.should.have.property('updatedUser').eql(null);
                res.body.should.have.property('created');
                res.body.should.have.property('updated');
                categoryId = res.body._id;
                chai.request(testHelper.getServer())
                    .post(`${apiUrl}/categories/${categoryId}`)
                    .send(category_2)
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.should.have.property('_id').eql(categoryId);
                        chai.request(testHelper.getServer())
                            .get(`${apiUrl}/categories/${categoryId}`)
                            .end((err, res) => {
                                res.body.should.have.property('name').eql(category_2.name);
                                res.body.should.have.property('description').eql(category_2.description);
                                res.body.should.have.property('active').eql(category_2.active);
                                res.body.should.have.property('createdUser').eql(user.username);
                                res.body.should.have.property('updatedUser').eql(user.username)
                                res.body.should.have.property('created');
                                res.body.should.have.property('updated');
                                chai.request(testHelper.getServer())
                                    .delete(`${apiUrl}/categories/${categoryId}`)
                                    .end((err, res) => {
                                        res.should.have.status(200);
                                        res.body.should.be.a('object');
                                        res.body.should.have.property('message').eql('successfully removed');
                                        done();
                                    });
                            });
                    });
            });
    });

    it('get products by category', (done) => {
        let categoryId;
        chai.request(testHelper.getServer())
            .put(`${apiUrl}/categories`)
            .send(category_2)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('name').eql(category_2.name);
                categoryId = res.body._id;
                // add two products with this categoryID and one without a matching ID
                let p1 = product;
                p1.category = categoryId;
                let p2 = product_2;
                p2.category = categoryId;
                // product with "wrong" categoryID
                chai.request(testHelper.getServer())
                    .put(`${apiUrl}/products`)
                    .send({
                        name: 'fooBarProd',
                        category: 'fooBarCat'
                    })
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.should.have.property('name').eql('fooBarProd');
                        res.body.should.have.property('category').eql('fooBarCat');
                        // add product with matching categoryID
                        chai.request(testHelper.getServer())
                            .put(`${apiUrl}/products`)
                            .send(p1)
                            .end((err, res) => {
                                res.should.have.status(200);
                                res.body.should.be.a('object');
                                res.body.should.have.property('name').eql(p1.name);
                                res.body.should.have.property('category').eql(categoryId);
                                // add product with matching categoryID
                                chai.request(testHelper.getServer())
                                    .put(`${apiUrl}/products`)
                                    .send(p2)
                                    .end((err, res) => {
                                        res.should.have.status(200);
                                        res.body.should.be.a('object');
                                        res.body.should.have.property('name').eql(p2.name);
                                        res.body.should.have.property('category').eql(categoryId);
                                        // test if we can get both products by categoryID
                                        chai.request(testHelper.getServer())
                                            .get(`${apiUrl}/categories/${categoryId}/products`)
                                            .end((err, res) => {
                                                res.should.have.status(200);
                                                res.body.should.be.a('array');
                                                res.body.length.should.be.eql(2);
                                                done();
                                            });
                                    });
                            });
                    });
            });
    });

    it('product with image', (done) => {
        let p1 = product;
        p1.image = exampleImage;
        chai.request(testHelper.getServer())
            .put(`${apiUrl}/products`)
            .send(p1)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('name').eql(p1.name);
                res.body.should.have.property('imageUrl');
                // test if we can load the image list
                chai.request(testHelper.getServer())
                    .get(`/api/data/uploads/undefined/products?userid=undefined`)
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('array');
                        res.body.length.should.be.eql(1);
                        let filename = res.body[0].name;
                        chai.request(testHelper.getServer())
                            .get(`/api/data/uploads/undefined/products/${filename}?userid=undefined`)
                            .end((err, res) => {
                                res.should.have.status(200);
                                done();
                            });
                    });
            });
    });
});
