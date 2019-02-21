const dbHelper = require('../lib/database_helper.js');
const logger = require('../lib/logging_helper.js').logger;
const prepareAndSaveImage = require('../lib/image_helper.js').prepareAndSaveImage;

module.exports = (router) => {
    router.route('/v1/services')
        /**
         * @api {get} /api/v1/services Get Service List
         * @apiName GetServicesList
         * @apiGroup Service
         * @apiPermission token/apikey
         * @apiVersion 1.0.0
         *
         * @apiSuccess {Object[Service]} Service Returns a list of services.
         */
        .get((req, res) => {
            let services;
            if (req.query.apikey || req.headers['x-stjorna-apikey']) {
                services = dbHelper.db.get('services').find({ active: true }).value();
            } else {
                services = dbHelper.db.get('services').value();
            }

            logger.log('debug', `service - load service list`);
            if (services) {
                res.send(services);
            } else {
                logger.error(`error occured: couldn't load your services`);
                res.status(400).send({ 'message': `Couldn't load your services`, 'status': 'error' });
            }
        })

        /**
         * @api {put} /api/v1/services Add Service
         * @apiPrivate
         * @apiName AddServices
         * @apiGroup Service
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         *
         * @apiSuccess {Object[Service]} Service Returns the created service.
         */
        .put((req, res) => {
            if (req.body.active) {
                req.body.active = JSON.parse(req.body.active);
            }
            // prepare and save image
            let imagePath = req.body.imageUrl;
            if (req.body.image && req.body.image.includes('data:image')) {
                imagePath = prepareAndSaveImage(req.body.image, '/services', req.headers['x-stjorna-userid']);
            }

            let service = {
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

            dbHelper.db.get('services')
                .push(service)
                .write()
                .then(() => {
                    let item = dbHelper.db.get('services').find({ _id: service._id }).value();
                    if (item) {
                        res.send(item);
                    } else {
                        log.err(`error occured: couldn't add service`);
                        res.status(400).send({ 'message': `Couldn't add service`, 'status': 'error' });
                    }
                });
        });

    router.route('/v1/services/:id')
    /**
     * @api {get} /api/v1/services/:id Get service
     * @apiName GetService
     * @apiGroup Service
     * @apiPermission token/apikey
     * @apiVersion 1.0.0
     *
     * @apiParam {String} id unique Service ID.
     *
     * @apiSuccess {Object} Service Returns a specific service by ID.
     * @apiSuccess {String} _id service unique ID
     * @apiSuccess {String} name Service name
     * @apiSuccess {String} description Service description (larger text)
     * @apiSuccess {String} category Category unique ID
     * @apiSuccess {Boolean} active Is the Service active over the remote api.
     * @apiSuccess {String} image Base64 image string, normally empty.
     * @apiSuccess {String} imageUrl Image url, when an image is uploaded.
     * @apiSuccess {Number} created Timestamp when the item was created.
     * @apiSuccess {String} createdUser UserID which user has created the item.
     * @apiSuccess {Number} updated Timestamp when the item was updated.
     * @apiSuccess {String} updatedUser UserID which user has updatged the item.
     */
        .get((req, res) => {
            let service = dbHelper.db.get('services').find({ _id: req.params.id }).value();
            if (service) {
                res.send(service);
            } else {
                log.err(`error occured: couldn't load service ${req.params.id}`);
                res.status(400).send({ 'message': `Couldn't load service ${req.params.id}`, 'status': 'error' });
            }
        })
        /**
         * @api {post} /api/v1/services/:id Update Service
         * @apiPrivate
         * @apiName UpdateService
         * @apiGroup Service
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         *
         * @apiParam {String} id unique Service ID.
         *
         * @apiSuccess {Object} Service Returns the updated Service by ID.
         */
        .post( (req, res) => {
            if (req.body.active) {
                req.body.active = JSON.parse(req.body.active);
            }
            // prepare and save image
            let imagePath = req.body.imageUrl;
            if (req.body.image && req.body.image.includes('data:image')) {
                imagePath = prepareAndSaveImage(req.body.image, '/services', req.headers['x-stjorna-userid']);
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

            dbHelper.db.get('services')
                .find({ _id: req.params.id })
                .assign(newItem)
                .write()
                .then(() => {
                    let item = dbHelper.db.get('services').find({ _id: req.params.id }).value();
                    if (item && item.updated === newItem.updated) {
                        res.send(item);
                    } else {
                        log.err(`error occured: couldn't update service '${req.params.id}'`);
                        res.status(400).send({ 'message': `Couldn't update service '${req.params.id}'`, 'status': 'error' });
                    }
                });
        })
        /**
         * @api {delete} /api/v1/services/:id Delete Service
         * @apiPrivate
         * @apiName DeleteService
         * @apiGroup Service
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         *
         * @apiParam {String} id unique Service ID.
         *
         * @apiSuccess {Object} Message Returns the status of the deleted Service.
         */
        .delete( (req, res) => {
            dbHelper.db.get('services')
                .remove({ _id: req.params.id })
                .write()
                .then(() => {
                    let item = dbHelper.db.get('services').find({ _id: req.params.id }).value();
                    if (!item) {
                        res.send({ 'message': 'successfully removed', 'status': 'ok' });
                    } else {
                        log.err(`error occured: couldn't remove service '${req.params.id}'`);
                        res.status(400).send({ 'message': `Couldn't remove service '${req.params.id}'`, 'status': 'error' });
                    }
                });
        });
}