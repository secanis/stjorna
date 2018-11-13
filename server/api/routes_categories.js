const dbHelper = require('../lib/database_helper.js');
const logger = require('../lib/logging_helper.js').logger;
const prepareAndSaveImage = require('../lib/image_helper.js').prepareAndSaveImage;

module.exports = (router) => {
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
            let categories;
            if (req.query.apikey || req.headers['x-stjorna-apikey']) {
                categories = dbHelper.db.get('categories').filter({ active: true }).value();
            } else {
                categories = dbHelper.db.get('categories').value();
            }

            logger.log('debug', `category - load category list`);
            if (categories) {
                res.send(categories);
            } else {
                logger.error(`category - error occured: couldn't load your categories`);
                res.status(400).send({ 'message': `Couldn't load your categories`, 'status': 'error' });
            }
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

            let newItem = {
                _id: dbHelper.generateId(),
                name: req.body.name,
                description: req.body.description || '',
                active: req.body.active,
                image: '',
                imageUrl: imagePath,
                created: new Date().getTime(),
                createdUser: req.body.createdUser,
                updated: new Date().getTime(),
                updatedUser: null
            };

            logger.log('debug', `category - add product with ID: ${newItem._id}`);
            dbHelper.db.get('categories')
                .push(newItem)
                .write()
                .then(() => {
                    let item = dbHelper.db.get('categories').find({ _id: newItem._id }).value();
                    if (item) {
                        res.send(item);
                    } else {
                        logger.error(`category - error occured: couldn't add category`);
                        res.status(400).send({ 'message': `Couldn't add category`, 'status': 'error' });
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
            let item = dbHelper.db.get('categories').filter({ _id: req.params.id }).value()[0];
            logger.log('debug', `category - get category with ID: ${req.params.id}`);
            if (item) {
                res.send(item);
            } else {
                logger.error(`category - error occured: couldn't load category '${req.params.id}'`);
                res.status(400).send({ 'message': `Couldn't load category '${req.params.id}'`, 'status': 'error' });
            }
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

            let newItem = {
                name: req.body.name,
                description: req.body.description,
                active: req.body.active,
                image: '',
                imageUrl: imagePath || '',
                updated: new Date().getTime(),
                updatedUser: req.body.updatedUser
            };

            logger.log('debug', `category - update category with ID: ${req.params.id}`);
            dbHelper.db.get('categories')
                .find({ _id: req.params.id })
                .assign(newItem)
                .write()
                .then(() => {
                    let item = dbHelper.db.get('categories').filter({ _id: req.params.id }).value()[0];
                    if (item && item.updated === newItem.updated) {
                        res.send(item);
                    } else {
                        logger.error(`category - error occured: couldn't update category '${req.params.id}'`);
                        res.status(400).send({ 'message': `Couldn't update category '${req.params.id}'`, 'status': 'error' });
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
            let productsWithCategory = dbHelper.db.get('products')
            .filter({ category: req.params.id })
            .value();
            
            if (productsWithCategory && productsWithCategory.length > 0) {
                logger.error(`category - error occured: couldn't remove category '${req.params.id}', because of existing products with this category`);
                logger.warn(`category - you have ${productsWithCategory.length} existing products on category ${req.params.id}`);
                res.status(400).send({ 'message': `Couldn't remove category '${req.params.id}', because of existing products with this category`, 'status': 'warning' });
            } else {
                logger.log('debug', `category - delete category with ID: ${req.params.id}`);
                dbHelper.db.get('categories')
                    .remove({ _id: req.params.id })
                    .write()
                    .then(() => {
                        let item = dbHelper.db.get('categories').filter({ _id: req.params.id }).value()[0];
                        if (!item) {
                            res.send({ 'message': 'successfully removed', 'status': 'ok' });
                        } else {
                            logger.error(`category - error occured: couldn't remove category '${req.params.id}'`);
                            res.status(400).send({ 'message': `Couldn't remove category '${req.params.id}'`, 'status': 'error' });
                        }
                    });
            }
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
            let products = dbHelper.db.get('products')
                .filter({ category: req.params.id, active: true })
                .value();

            if (products) {
                res.send(products);
            } else {
                logger.error(`category - error occured: couldn't load your products by category '${req.params.id}'`);
                res.status(400).send({ 'message': `Couldn't load your products by category '${req.params.id}'`, 'status': 'error' });
            }
        });

    router.route('/v1/categories/:id/services')
    /**
     * @api {get} /api/v1/categories/:id/services Get Services by Category
     * @apiName GetServicesByCategory
     * @apiGroup Category
     * @apiPermission token/apikey
     * @apiVersion 1.0.0
     *
     * @apiParam {String} id Category ID.
     *
     * @apiSuccess {Object[Service]} Service Returns a list of services.
     */
        .get((req, res) => {
            let services = dbHelper.db.get('services')
                .filter({ category: req.params.id, active: true })
                .value();

            if (services) {
                res.send(services);
            } else {
                log.err(`error occured: couldn't load your services by category '${req.params.id}'`);
                res.status(400).send({ 'message': `Couldn't load your services by category '${req.params.id}'`, 'status': 'error' });
            }
        });
};