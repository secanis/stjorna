const crypto = require('crypto');

const dbHelper = require('../lib/database_helper.js');
const fileHelper = require('../lib/file_helper.js');

module.exports = (router, log) => {
    router.route('/v1/settings')
        /**
         * @api {get} /api/v1/settings Get Settings
         * @apiPrivate
         * @apiName GetSettings
         * @apiGroup Settings
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         *
         * @apiSuccess {string} password_secret Returns Settings object
         * @apiSuccess {boolean} allow_remote_access Returns Settings object
         * @apiSuccess {string} image_dimension Returns Settings object
         * @apiSuccess {string} image_quality Get the value of password quality
         */
        .get((req, res) => {
            fileHelper.loadConfigFile((err, config) => {
                if (!err && config) {
                    log.inf(`get configuration file`);
                    res.send(JSON.parse(config));
                } else {
                    log.err(`couldn't get configuration`);
                    res.status(400).send({ 'message': 'configuration error', 'status': 'error' });
                }
            });
        })
        /**
         * @api {post} /api/v1/settings Save Settings
         * @apiPrivate
         * @apiName SaveSettings
         * @apiGroup Settings
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         *
         * @apiSuccess {string} message Returns a message to the save process
         * @apiSuccess {string} status Returns the status of the save process
         */
        .post((req, res) => {
            fileHelper.saveConfigFile(req.body, (err, config) => {
                if (err) {
                    log.err(`couldn't save configuration`);
                    res.status(400).send({ 'message': `save configuration error: ${err.message}`, 'status': 'error' });
                } else {
                    log.inf(`configuration saved`);
                    res.status(200).send({ 'message': 'configuration successfully saved', 'status': 'ok' });
                }
            });
        });

    router.route('/v1/export/:filetype')
        /**
         * @api {get} /api/v1/export/:filetype Export Data
         * @apiPrivate
         * @apiName ExportData
         * @apiGroup Settings
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} filetype Filetype of your export (json | excel)
         * 
         * @apiSuccess {string} file Returns the export as file download
         */
        .get((req, res) => {
            if (req.params.filetype) {
                fileHelper.gernerateExport(req.params.filetype, (err, fileObject) => {
                    if (!err) {
                        res.setHeader('Content-disposition', `attachment; filename= stjorna_export_${new Date().getTime()}.${fileObject.fileSuffix}`);
                        res.setHeader('Content-type', fileObject.contentType);
                        res.send(fileObject.file);
                    } else {
                        res.status(400).send({ 'message': `error while creating file: ${err.message}`, 'status': 'error' });
                    }
                });
            } else {
                res.status(400).send({ 'message': 'please give a correct filetype', 'status': 'error' });
            }
        });

    router.route('/v1/setup')
        /**
         * @api {get} /api/v1/setup Get Setup Status
         * @apiPrivate
         * @apiName GetSetup
         * @apiGroup Setup
         * @apiPermission none
         * @apiVersion 1.0.0
         *
         * @apiSuccess {string} message Returns a message string
         * @apiSuccess {boolean} installed Returns the installation
         */
        .get((req, res) => {
            res.send({
                'message': 'installation status stjorna',
                'allow_remote_access': process.env.STJORNACONFIG_ALLOW_REMOTE_ACCESS == true,
                'image_dimension': process.env.STJORNACONFIG_IMAGE_DIMENSION - 0,
                'image_quality': process.env.STJORNACONFIG_IMAGE_QUALITY - 0,
                'installed': process.env.STJORNACONFIG_INSTALLED == true
            });
        })
        /**
         * @api {post} /api/v1/setup Create Setup
         * @apiPrivate
         * @apiName SaveSetup
         * @apiGroup Setup
         * @apiPermission none
         * @apiVersion 1.0.0
         *
         * @apiSuccess {string} message Returns a message to the save process
         * @apiSuccess {string} status Returns the status of the save process
         */
        .post((req, res) => {
            // database files are created it self by nedb
            if (!fileHelper.isConfigFileExisting()) {

                let responseMessage = {
                    'config_status': {
                        'errors': [],
                        'status': 'ok'
                    },
                    'user_status': {
                        'errors': [],
                        'status': 'ok'
                    }
                };
                // generate security token
                let securityTokenHash = crypto.createHash('sha512');
                securityTokenHash.update(new Date().getTime().toString());
                process.env.STJORNACONFIG_PASSWORD_SECRECT = securityTokenHash.digest('hex');
                req.body.config.installed = true;
                // create initial config file
                fileHelper.saveConfigFile(req.body.config, (err, config) => {
                    if (err) {
                        log.err(`error occured: ${err.message}`);
                        responseMessage.config_status.errors.push(err.message);
                    } else {
                        log.inf(`configuration saved`);
                    }
                });
                // add user
                let hash = crypto.createHash('sha512');
                hash.update(req.body.user.password + process.env.STJORNACONFIG_PASSWORD_SECRECT);
                hash = hash.digest('hex');

                let newItem = {
                    _id: dbHelper.generateId(),
                    username: req.body.user.username,
                    password: hash,
                    email: req.body.user.email,
                    apikey: '',
                    created: new Date().getTime(),
                    updated: new Date().getTime()
                };

                dbHelper.db.get('users')
                    .push(newItem)
                    .write()
                    .then(() => {
                        log.inf(`user '${req.body.user.username}' added`);
                    });

                // send response to frontend
                if (responseMessage.config_status.errors.length > 0 || responseMessage.user_status.errors.length > 0) {
                    res.status(400).send({ 'message': responseMessage, 'status': 'error' });
                } else {
                    res.send({ 'message': responseMessage, 'status': 'ok' });
                }
            } else {
                // config file is existing, prevent possible overwriting
                res.status(400).send({ 'message': 'configuration successfully saved', 'status': 'ok' });
            }
        });
};