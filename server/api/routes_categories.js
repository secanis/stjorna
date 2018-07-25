const db_products = require('../lib/database_helper.js').db_products;
const db_categories = require('../lib/database_helper.js').db_categories;
const prepareAndSaveImage = require('../lib/image_helper.js').prepareAndSaveImage;

module.exports = (router, log) => {
    router.route('/v1/categories')
        /**
         * @api {get} /api/v1/categories Get Category List
         * @apiName GetCategoryList
         * @apiGroup Category
         * @apiPermission token/apikey
         * @apiVersion 1.0.0
         *
         * @apiSuccess {Object[Category]} Category Returns a list of categories.
         */
        .get((req, res) => {
            let options = {};
            if (req.query.apikey || req.headers['x-stjorna-apikey']) {
                options = {active: true};
            }

            db_categories.find(options, (err, docs) => {
                if (!err) {
                    res.send(docs);
                } else {
                    log.err(`error occured: ${err.message}`);
                    res.status(400).send({ 'error': err, 'status': 'error' });
                }
            });
        })
        /**
         * @api {put} /api/v1/categories Add Category
         * @apiPrivate
         * @apiName AddCategory
         * @apiGroup Category
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         *
         * @apiSuccess {Object} Category Return the added category.
         */
        .put((req, res) => {
            if (req.body.active) {
                req.body.active = JSON.parse(req.body.active);
            }
            // prepare and save image
            let imagePath = req.body.imageUrl;
            if (req.body.image && req.body.image.includes('data:image')) {
                imagePath = prepareAndSaveImage(req.body.image, '/categories', req.headers['x-stjorna-userid']);
            }
            db_categories.insert({ 
                name: req.body.name,
                description: req.body.description || '',
                active: req.body.active,
                image: '',
                imageUrl: imagePath,
                created: new Date().getTime(),
                createdUser: req.body.createdUser,
                updated: new Date().getTime(),
                updatedUser: null
            }, (err, doc) => {
                if (!err) {
                    res.send(doc);
                } else {
                    log.err(`error occured: ${err.message}`);
                    res.status(400).send({ 'error': err, 'status': 'error' });
                }
            });
        });

    router.route('/v1/categories/:id')
        /**
         * @api {get} /api/v1/categories/:id Get Category
         * @apiName GetCategory
         * @apiGroup Category
         * @apiPermission token/apikey
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} id unique Category ID.
         *
         * @apiSuccess {String} _id Category unique ID
         * @apiSuccess {String} name Category name
         * @apiSuccess {String} description Category description (larger text)
         * @apiSuccess {Boolean} active Is the Category active over the remote api.
         * @apiSuccess {String} image Base64 image string, normally empty.
         * @apiSuccess {String} imageUrl Image url, when an image is uploaded.
         * @apiSuccess {Number} created Timestamp when the item was created.
         * @apiSuccess {String} createdUser UserID which user has created the item.
         * @apiSuccess {Number} updated Timestamp when the item was updated.
         * @apiSuccess {String} updatedUser UserID which user has updatged the item.
         */
        .get((req, res) => {
            db_categories.findOne({ _id: req.params.id }, (err, doc) => {
                if (!err) {
                    res.send(doc);
                } else {
                    res.status(400).send({ 'message': err.message, 'status': 'error' });
                }
            });
        })
        /**
         * @api {post} /api/v1/categories/:id Update Category
         * @apiPrivate
         * @apiName UpdateCategory
         * @apiGroup Category
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} id unique category ID.
         *
         * @apiSuccess {Object} Category Returns the updated category by ID.
         */
        .post((req, res) => {
            if (req.body.active) {
                req.body.active = JSON.parse(req.body.active);
            }
            // prepare and save image
            let imagePath = req.body.imageUrl;
            if (req.body.image && req.body.image.includes('data:image')) {
                imagePath = prepareAndSaveImage(req.body.image, '/categories', req.headers['x-stjorna-userid']);
            }
            db_categories.update({ _id: req.params.id }, { $set: {
                name: req.body.name,
                description: req.body.description,
                active: req.body.active,
                image: '',
                imageUrl: imagePath,
                updated: new Date().getTime(),
                updatedUser: req.body.updatedUser
            } }, { returnUpdatedDocs: true }, (err, numReplaced, affectedDocument) => {
                if (!err && numReplaced === 1) {
                    res.send({ 'message': 'successfully updated', 'status': 'ok' });
                } else {
                    log.err(`error occured: ${err}`);
                    res.status(400).send({ 'message': err, 'status': 'error' });
                }
            });
        })
        /**
         * @api {delete} /api/v1/categories/:id Delete Category
         * @apiPrivate
         * @apiName DeleteCategory
         * @apiGroup Category
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} id unique category ID.
         *
         * @apiSuccess {Object} Message Returns the status of the deleted category.
         */
        .delete((req, res) => {
            db_categories.findOne({ _id: req.params.id }, (err, doc) => {
                db_categories.remove({ _id: req.params.id }, {}, (err, numRemoved) => {
                    if (!err && numRemoved === 1) {
                        res.send({ 'message': 'successfully removed', 'status': 'ok' });
                    } else {
                        res.status(400).send({ 'message': err.message, 'status': 'error', 'message': 'could not delete category' });
                    }
                });
            });
        });

    router.route('/v1/categories/:id/products')
        /**
         * @api {get} /api/v1/categories/:id/products Get Products by Category
         * @apiName GetProductsByCategory
         * @apiGroup Category
         * @apiPermission token/apikey
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} id Category ID.
         *
         * @apiSuccess {Object[Product]} Product Returns a list of products.
         */
        .get((req, res) => {
            db_products.find({ category: req.params.id, active: true }, (err, docs) => {
                if (!err) {
                    res.send(docs);
                } else {
                    log.err(`error occured: ${err.message}`);
                    res.status(400).send({ 'error': err.message, 'status': 'error' });
                }
            });
        })
}