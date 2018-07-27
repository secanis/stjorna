const dbHelper = require('../lib/database_helper.js');
const prepareAndSaveImage = require('../lib/image_helper.js').prepareAndSaveImage;

module.exports = (router, log) => {
    router.route('/v1/products')
        /**
         * @api {get} /api/v1/products Get Product List
         * @apiName GetProductsList
         * @apiGroup Product
         * @apiPermission token/apikey
         * @apiVersion 1.0.0
         *
         * @apiSuccess {Object[Product]} Product Returns a list of products.
         */
        .get((req, res) => {
            let products;
            if (req.query.apikey || req.headers['x-stjorna-apikey']) {
                products = dbHelper.db.get('products').find({ active: true }).value();
            } else {
                products = dbHelper.db.get('products').value();
            }

            if (products) {
                res.send(products);
            } else {
                log.err(`error occured: couldn't load your products`);
                res.status(400).send({ 'message': `Couldn't load your products`, 'status': 'error' });
            }
        })
        /**
         * @api {put} /api/v1/products Add Product
         * @apiPrivate
         * @apiName AddProducts
         * @apiGroup Product
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         *
         * @apiSuccess {Object[Product]} Product Returns a list of products.
         */
        .put((req, res) => {
            if (req.body.active) {
                req.body.active = JSON.parse(req.body.active);
            }
            // prepare and save image
            let imagePath = req.body.imageUrl;
            if (req.body.image && req.body.image.includes('data:image')) {
                imagePath = prepareAndSaveImage(req.body.image, '/products', req.headers['x-stjorna-userid']);
            }

            let newItem = {
                _id: dbHelper.generateId(),
                name: req.body.name,
                category: req.body.category,
                price: req.body.price,
                description: req.body.description,
                active: req.body.active,
                image: '',
                imageUrl: imagePath || '',
                created: new Date().getTime(),
                createdUser: req.body.createdUser,
                updated: new Date().getTime(),
                updatedUser: null
            };

            dbHelper.db.get('products')
                .push(newItem)
                .write()
                .then(() => {
                    let item = dbHelper.db.get('products').find({ _id: newItem._id }).value();
                    if (item) {
                        res.send(item);
                    } else {
                        log.err(`error occured: couldn't add product`);
                        res.status(400).send({ 'message': `Couldn't add product`, 'status': 'error' });
                    }
                });
        });

    router.route('/v1/products/:id')
        /**
         * @api {get} /api/v1/products/:id Get Product
         * @apiName GetProduct
         * @apiGroup Product
         * @apiPermission token/apikey
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} id unique Product ID.
         *
         * @apiSuccess {Object} Product Returns a specific Product by ID.
         * @apiSuccess {String} _id Product unique ID
         * @apiSuccess {String} name Product name
         * @apiSuccess {String} description Product description (larger text)
         * @apiSuccess {String} category Category unique ID
         * @apiSuccess {Boolean} active Is the Product active over the remote api.
         * @apiSuccess {String} image Base64 image string, normally empty.
         * @apiSuccess {String} imageUrl Image url, when an image is uploaded.
         * @apiSuccess {Number} created Timestamp when the item was created.
         * @apiSuccess {String} createdUser UserID which user has created the item.
         * @apiSuccess {Number} updated Timestamp when the item was updated.
         * @apiSuccess {String} updatedUser UserID which user has updatged the item.
         */
        .get((req, res) => {
            let product = dbHelper.db.get('products').find({ _id: req.params.id }).value();
            if (product) {
                res.send(product);
            } else {
                log.err(`error occured: couldn't load product ${req.params.id}`);
                res.status(400).send({ 'message': `Couldn't load product ${req.params.id}`, 'status': 'error' });
            }
        })
        /**
         * @api {post} /api/v1/products/:id Update Product
         * @apiPrivate
         * @apiName UpdateProduct
         * @apiGroup Product
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} id unique Product ID.
         *
         * @apiSuccess {Object} Product Returns the updated Product by ID.
         */
        .post( (req, res) => {
            if (req.body.active) {
                req.body.active = JSON.parse(req.body.active);
            }
            // prepare and save image
            let imagePath = req.body.imageUrl;
            if (req.body.image && req.body.image.includes('data:image')) {
                imagePath = prepareAndSaveImage(req.body.image, '/products', req.headers['x-stjorna-userid']);
            }

            let newItem = {
                name: req.body.name,
                category: req.body.category,
                price: req.body.price,
                description: req.body.description,
                active: req.body.active,
                image: '',
                imageUrl: imagePath,
                updated: new Date().getTime(),
                updatedUser: req.body.updatedUser
            };

            dbHelper.db.get('products')
                .find({ _id: req.params.id })
                .assign(newItem)
                .write()
                .then(() => {
                    let item = dbHelper.db.get('products').find({ _id: req.params.id }).value();
                    if (item && item.updated === newItem.updated) {
                        res.send(item);
                    } else {
                        log.err(`error occured: couldn't update product '${req.params.id}'`);
                        res.status(400).send({ 'message': `Couldn't update product '${req.params.id}'`, 'status': 'error' });
                    }
                });
        })
        /**
         * @api {delete} /api/v1/products/:id Delete Product
         * @apiPrivate
         * @apiName DeleteProduct
         * @apiGroup Product
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} id unique Product ID.
         *
         * @apiSuccess {Object} Message Returns the status of the deleted Product.
         */
        .delete( (req, res) => {
            dbHelper.db.get('products')
                .remove({ _id: req.params.id })
                .write()
                .then(() => {
                    let item = dbHelper.db.get('products').find({ _id: req.params.id }).value();
                    if (!item) {
                        res.send({ 'message': 'successfully removed', 'status': 'ok' });
                    } else {
                        log.err(`error occured: couldn't remove products '${req.params.id}'`);
                        res.status(400).send({ 'message': `Couldn't remove products '${req.params.id}'`, 'status': 'error' });
                    }
                });
        });
}