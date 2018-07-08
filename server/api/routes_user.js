const crypto = require('crypto');

const db_users = require('../lib/database_helper.js').db_users;
const fileHelper = require('../lib/file_helper.js');

module.exports = (router, log) => {
    router.route('/v1/users')
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
                        db_users.insert({ username: req.body.username, email: req.body.email, password: hash.digest('hex') }, (err, doc) => {
                            if (!err) {
                                res.send(doc);
                            } else {
                                log.err(`error occured: ${err.message}`);
                                res.status(400).send({ 'message': err.message, 'status': 'error' });
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
                        db_users.findOne({ _id: req.params.id, password: passwordHash }, (err, doc) => {
                            if (!err && doc) {
                                // refresh hash if password are the same
                                if (passwordHash === doc.password) {
                                    if (req.body.passwordNew && req.body.passwordNewRepeat && req.body.passwordNew === req.body.passwordNewRepeat) {
                                        let hashNew = crypto.createHash('sha512');
                                        hashNew.update(req.body.passwordNew + stjornaConfig.password_secret);
                                        doc.password = hashNew.digest('hex');
                                    } else {
                                        doc.email = req.body.email;
                                    }
                                    doc.updated = new Date().getTime();
                                    db_users.update({ _id: req.params.id }, { $set: doc }, { returnUpdatedDocs: true }, (err, numReplaced, affectedDocument) => {
                                        if (!err && numReplaced === 1) {
                                            res.send({
                                                "status": "ok",
                                                "message": "successfully updated",
                                                "_id": affectedDocument._id,
                                                "username": affectedDocument.username,
                                                "email": affectedDocument.email,
                                                "token": req.query.token || req.headers['x-stjorna-access-token']
                                            });
                                        } else {
                                            log.err(`error occured: ${err.message}`);
                                            res.status(400).send({ 'message': err, 'status': 'error' });
                                        }
                                    });
                                } else {
                                    res.status(400).send({ 'message': 'your password was not correct, or the new one\'s were not the same.', 'status': 'error' });
                                }
                            } else {
                                // send response without error message when no error occurs because of an empty db response
                                if (err && err.message) {
                                    log.err(`error occured: ${err.message}`);
                                    res.status(400).send({ 'message': err.message, 'status': 'error' });
                                } else {
                                    let message = 'values are not correct, check your password';
                                    log.err(`error occured: ${message}`);
                                    res.status(400).send({ 'message': `${message}`, 'status': 'error' });
                                }
                            }
                        });
                    } else {
                        log.err(`error occured: ${err.message}`);
                        res.status(400).send({ 'message': err, 'status': 'error' });
                    }
                });
            } else {
                res.status(400).send({ 'message': 'not valid parameters, checkout the api documentation.', 'status': 'error' });
            }
        })

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
            if (req.decoded._id === req.params.id) {
                db_users.findOne({ _id: req.params.id }, (err, doc) => {
                    if (!err) {
                        res.send({
                            '_id': doc._id,
                            'apikey': doc.apikey
                        });
                    } else {
                        log.err(`error occured: ${err.message}`);
                        res.status(400).send({ 'message': err.message, 'status': 'error' });
                    }
                });
            } else {
                let errmessage = 'Operation not allowed, verification failed.';
                log.err(`error occured: ${errmessage}`);
                res.status(400).send({ 'message': errmessage, 'status': 'error' });
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
                db_users.findOne({ _id: req.params.id }, (err, doc) => {
                    if (!err && doc) {
                        // generate a new apikey
                        // replace unwanted chars (problems in urls)
                        let apikeyNew = crypto.randomBytes(48).toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
                        // reset the apikey
                        db_users.update({ _id: req.params.id }, { $set: { apikey: apikeyNew, updated: new Date().getTime() } }, { returnUpdatedDocs: true }, (err, numReplaced, affectedDocument) => {
                            if (!err && numReplaced === 1) {
                                res.send({ 'message': 'successfully updated', 'status': 'ok' });
                            } else {
                                log.err(`error occured: ${err.message}`);
                                res.status(400).send({ 'message': err, 'status': 'error' });
                            }
                        });
                    } else {
                        log.err(`error occured: could not replace apikey`);
                        res.status(400).send({ 'message': 'could not replace apikey', 'status': 'error' });
                    }
                });
            } else {
                res.status(400).send({ 'message': 'not valid parameters, checkout the api documentation.', 'status': 'error' });
            }
        })
}