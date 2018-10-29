const crypto = require('crypto');

const dbHelper = require('../lib/database_helper.js');
const fileHelper = require('../lib/file_helper.js');

module.exports = (router, log) => {
    router.route('/v1/users')
        .get((req, res) => {
            // check env variables, to work just in test or "no security" mode for security reasons
            if (process.env.NODE_ENV === 'test' && process.env.STJORNA_SECURITY === 'none') {
                let users = dbHelper.db.get('users').value();
                if (users) {
                    res.send(users);
                } else {
                    log.err(`error occured: couldn't load your users`);
                    res.status(400).send({ 'message': `Couldn't load your users`, 'status': 'error' });
                }
            } else {
                res.status(405).send({ 'message': 'method not allowed', 'status': 'error' });
            }
        })
        /**
         * @api {put} /api/v1/users/ Add User
         * @apiPrivate
         * @apiName AddUser
         * @apiGroup User
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         *
         * @apiSuccess {Object} User Returns user object.
         */
        .put((req, res) => {
            if (req.body.password && req.body.username) {
                fileHelper.loadConfigFile((err, config) => {
                    if(!err) {
                        let hash = crypto.createHash('sha512');
                        hash.update(req.body.password + JSON.parse(config).password_secret);

                        let newItem = {
                            _id: dbHelper.generateId(),
                            username: req.body.username,
                            password: hash.digest('hex'),
                            email: req.body.email,
                            apikey: '',
                            language: req.body.language,
                            created: new Date().getTime(),
                            updated: new Date().getTime()
                        };

                        dbHelper.db.get('users')
                            .push(newItem)
                            .write()
                            .then(() => {
                                let item = dbHelper.db.get('users').find({ _id: newItem._id }).value();
                                if (item) {
                                    res.send(item);
                                } else {
                                    log.err(`error occured: couldn't add user`);
                                    res.status(400).send({ 'message': `Couldn't add user`, 'status': 'error' });
                                }
                            });
                    } else {
                        log.err(`error occured: ${err.message}`);
                        res.status(400).send({ 'message': err.message, 'status': 'error' });
                    }
                });
            }
        });

    router.route('/v1/users/:id')
        /**
         * @api {post} /api/v1/users/:id Update User
         * @apiPrivate
         * @apiName UpdateUser
         * @apiGroup User
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         *
         * @apiParam {String} id users unique ID.
         *
         * @apiSuccess {Object} User Returns updated user object.
         */
        .post((req, res) => {
            if (req.body.password && req.params.id) {
                fileHelper.loadConfigFile((err, config) => {
                    if (!err) {
                        let stjornaConfig = JSON.parse(config);
                        // generatae new hash and add passwort data
                        let hash = crypto.createHash('sha512');
                        hash.update(req.body.password + stjornaConfig.password_secret);
                        let passwordHash = hash.digest('hex');
                        // search if an user exists with this data in the db
                        let newItem = dbHelper.db.get('users').find({ _id: req.params.id, password: passwordHash }).value();
                        if (newItem) {
                            // refresh hash if password are the same
                            if (req.body.passwordNew && req.body.passwordNewRepeat && req.body.passwordNew === req.body.passwordNewRepeat) {
                                let hashNew = crypto.createHash('sha512');
                                hashNew.update(req.body.passwordNew + stjornaConfig.password_secret);
                                newItem.password = hashNew.digest('hex');
                            }
                            newItem.email = req.body.email;
                            newItem.language = req.body.language;
                            newItem.updated = new Date().getTime();

                            dbHelper.db.get('users')
                                .find({ _id: req.params.id })
                                .assign(newItem)
                                .write()
                                .then(() => {
                                    let item = dbHelper.db.get('users').filter({ _id: req.params.id }).value()[0];
                                    if (item && item.updated === newItem.updated) {
                                        res.send({
                                            "_id": item._id,
                                            "username": item.username,
                                            "email": item.email,
                                            "language": item.language
                                        });
                                    } else {
                                        log.err(`error occured: couldn't update user '${req.params.id}'`);
                                        res.status(400).send({ 'message': `Couldn't update user '${req.params.id}'`, 'status': 'error' });
                                    }
                                });
                        } else {
                            log.err(`error occured: couldn't successful authenticate user '${req.params.id}'`);
                            res.status(400).send({ 'message': `Couldn't successful authenticate user '${req.params.id}'`, 'status': 'error' });
                        }
                    } else {
                        log.err(`error occured: ${err.message}`);
                        res.status(400).send({ 'message': err.message, 'status': 'error' });
                    }
                });
            } else {
                res.status(400).send({ 'message': 'not valid parameters, checkout the api documentation.', 'status': 'error' });
            }
        });

    router.route('/v1/users/apikey/:id')
        /**
         * @api {get} /api/v1/users/apikey/:id Get APIKEY by UserID
         * @apiPrivate
         * @apiName GetApiKey
         * @apiGroup User
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} id users unique ID.
         *
         * @apiSuccess {Object} Apikey Returns apikey object.
         */
        .get((req, res) =>  {
            // doubled verification for more security
            if (req.decoded._id === req.params.id) {
                let item = dbHelper.db.get('users').find({ _id: req.params.id }).value();
                if (item) {
                    res.send({
                        '_id': item._id,
                        'apikey': item.apikey
                    });
                } else {
                    log.err(`error occured: couldn't load apikey for user '${req.params.id}'`);
                    res.status(400).send({ 'message': `Couldn't load apikey for user '${req.params.id}'`, 'status': 'error' });
                }
            } else {
                log.err(`error occured: operation not allowed, verification failed`);
                res.status(400).send({ 'message': 'Operation not allowed, verification failed.', 'status': 'error' });
            }
        })
        /**
         * @api {post} /api/v1/users/apikey/:id Generate APIKEY by UserID
         * @apiPrivate
         * @apiName GenerateApiKey
         * @apiGroup User
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} id users unique ID.
         *
         * @apiSuccess {Object} Apikey Returns a status ok message object.
         */
        .post((req, res) => {
            if (req.decoded._id === req.params.id) {
                // generate a new apikey
                // replace unwanted chars (problems in urls)
                let newItem = {
                    apikey: crypto.randomBytes(48).toString('base64').replace(/\//g, '_').replace(/\+/g, '-'),
                    updated: new Date().getTime()
                };
                // reset the apikey
                dbHelper.db.get('users')
                    .find({ _id: req.params.id })
                    .assign(newItem)
                    .write()
                    .then(() => {
                        let item = dbHelper.db.get('users').filter({ _id: req.params.id }).value()[0];
                        if (item && item.updated === newItem.updated) {
                            res.send(item);
                        } else {
                            log.err(`error occured: couldn't replace apikey for user ${req.params.id}`);
                            res.status(400).send({ 'message': `Couldn't replace apikey for user ${req.params.id}`, 'status': 'error' });
                        }
                    });
            } else {
                res.status(400).send({ 'message': 'not valid parameters, checkout the api documentation.', 'status': 'error' });
            }
        })
};