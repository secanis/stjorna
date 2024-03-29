const crypto = require('crypto');
const moment = require('moment');
const fs = require('fs');

const dbHelper = require('../lib/database_helper.cjs');
const fileHelper = require('../lib/file_helper.cjs');
const { getAllCronInfo } = require('../lib/cronjob_helper.cjs');
const upload_helper = require('../lib/upload_helper.cjs');
const database_helper = require('../lib/database_helper.cjs');
const logger = require('../lib/logging_helper.cjs').logger;

module.exports = (router) => {
    router
        .route('/v1/settings')
        /**
         * @api {get} /api/v1/settings Get Settings
         * @apiPrivate
         * @apiName GetSettings
         * @apiGroup Settings
         * @apiPermission loggedin
         * @apiVersion 1.2.0
         *
         * @apiSuccess {string} password_secret Returns Settings object
         * @apiSuccess {boolean} allow_remote_access Returns Settings object
         * @apiSuccess {object} image Returns Image Settings object
         * @apiSuccess {number} image.width Width for saved image
         * @apiSuccess {number} image.height Height for saved image
         * @apiSuccess {number} image.quality Quality for saved image
         */
        .get((req, res) => {
            fileHelper.loadConfigFile((err, config) => {
                if (!err && config) {
                    logger.log('debug', `get configuration file`);
                    res.send(JSON.parse(config));
                } else {
                    logger.error(`couldn't get configuration`);
                    res.status(400).send({ message: 'configuration error', status: 'error' });
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
                    logger.error(`couldn't save configuration`);
                    res.status(400).send({ message: `save configuration error: ${err.message}`, status: 'error' });
                } else {
                    logger.log('debug', `configuration saved`);
                    res.status(200).send({ message: 'configuration successfully saved', status: 'ok' });
                }
            });
        });

    router
        .route('/v1/state/cron')
        /**
         * @api {get} /api/v1/state/cron Get Cron State
         * @apiPrivate
         * @apiName GetCronState
         * @apiGroup State
         * @apiPermission loggedin
         * @apiVersion 1.3.0
         *
         * @apiSuccess {date} timestamp of the last entry/modification
         * @apiSuccess {object} cronjobs The cronjob entry item
         * @apiSuccess {string} cronjobs.name Cronjob name
         * @apiSuccess {boolean} cronjobs.ok Is the cronjob working as expected
         * @apiSuccess {date} cronjobs.last Last execution of the cronjob
         * @apiSuccess {date} cronjobs.next Next execution of the cronjob
         * @apiSuccess {date} cronjobs.timestamp Updated the state entry
         */
        .get((req, res) => {
            const cronState = getAllCronInfo();
            cronState.forEach((e) => (e['ok'] = moment(new Date()).isBetween(e.last, e.next)));
            logger.log('debug', `get cronstate file`);
            res.send(cronState);
        });

    router
        .route('/v1/export/:filetype')
        /**
         * @api {get} /api/v1/export/:filetype Export Data or create complete backup with 'zip' parameter
         * @apiPrivate
         * @apiName ExportData
         * @apiGroup Settings
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         *
         * @apiParam {String} filetype Filetype of your export (json | excel | zip)
         *
         * @apiSuccess {string} file Returns the export as file download
         */
        .get((req, res) => {
            if (req.params.filetype) {
                fileHelper.gernerateExport(req.params.filetype, (err, fileObject) => {
                    // set headers for correct response to client
                    if (fileObject) {
                        // just set the headers if we have some file info
                        res.setHeader('Content-disposition', `attachment; filename=stjorna_export_${new Date().getTime()}.${fileObject.fileSuffix}`);
                        res.setHeader('Content-type', fileObject.contentType);
                    }
                    res.setHeader('Access-Control-Expose-Headers', 'content-disposition');
                    // return the correct response to the client, stringify because of blob
                    if (!err) {
                        res.send(fileObject.file);
                    } else {
                        logger.error(`export - error while creating file: ${err.message}`);
                        res.status(400).send(JSON.stringify({ message: `error while creating file: ${err.message}`, status: 'error' }));
                    }
                });
            } else {
                logger.error(`export - error while creating file, please give a correct filetype`);
                res.status(400).send({ message: 'error while creating file, please give a correct filetype', status: 'error' });
            }
        });

    router
        .route('/v1/reset')
        /**
         * @api {post} /api/v1/reset Reset Stjorna database
         * @apiPrivate
         * @apiName Reset
         * @apiGroup Settings
         * @apiPermission loggedin
         * @apiVersion 1.4.0
         *
         * @apiSuccess {boolean} success Returns reset status
         */
        .post((req, res) => {
            try {
                fs.rmSync(process.env.STJORNA_SERVER_STORAGE, { recursive: true });
                logger.warn(`reset of complete Stjorna database done!`);
                res.send({ success: true });
            } catch (err) {
                logger.error(`reset database: ${err.message}`);
                res.status(500).send({ success: false });
            }
        });

    router
        .route('/v1/restore')
        /**
         * @api {post} /api/v1/restore Restore Stjorna database
         * @apiPrivate
         * @apiName Restore
         * @apiGroup Settings
         * @apiPermission none
         * @apiVersion 1.4.0
         *
         * @apiSuccess {boolean} success Returns Restore status
         */
        .post((req, res) => {
            const form = upload_helper.getForm(req);

            form.on('file', async (name, file) => {
                await upload_helper.extractZip();
                database_helper.initialize();
                return res.send({
                    success: true,
                });
            });

            form.on('error', (err) => {
                console.log(err);
                return res.status(400).send({
                    success: false,
                });
            });
        });

    router
        .route('/v1/setup')
        /**
         * @api {option} /api/v1/setup Get Setup Status without Login
         * @apiPrivate
         * @apiName GetSetupWithoutLogin
         * @apiGroup Setup
         * @apiPermission none
         * @apiVersion 1.0.0
         *
         * @apiSuccess {string} message Returns a message string
         * @apiSuccess {boolean} installed Returns the installation
         */

        /**
         * @api {get} /api/v1/setup Get Setup Status with Login
         * @apiPrivate
         * @apiName GetSetupWithLogin
         * @apiGroup Setup
         * @apiPermission loggedin
         * @apiVersion 1.2.0
         *
         * @apiSuccess {string} password_secret Returns Settings object
         * @apiSuccess {boolean} allow_remote_access Returns Settings object
         * @apiSuccess {object} image Returns Image Settings object
         * @apiSuccess {number} image.width Width for saved image
         * @apiSuccess {number} image.height Height for saved image
         * @apiSuccess {number} image.quality Quality for saved image
         */
        .get((req, res) => {
            res.send({
                message: 'installation status stjorna',
                allow_remote_access: process.env.STJORNACONFIG_ALLOW_REMOTE_ACCESS == true,
                image: {
                    width: process.env.STJORNACONFIG_IMAGE_WIDTH - 0,
                    height: process.env.STJORNACONFIG_IMAGE_HEIGHT - 0,
                    quality: process.env.STJORNACONFIG_IMAGE_QUALITY - 0,
                },
                installed: process.env.STJORNACONFIG_INSTALLED == true,
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
                    config_status: {
                        errors: [],
                        status: 'ok',
                    },
                    user_status: {
                        errors: [],
                        status: 'ok',
                    },
                };
                // generate security token
                let securityTokenHash = crypto.createHash('sha512');
                securityTokenHash.update(new Date().getTime().toString());
                process.env.STJORNACONFIG_PASSWORD_SECRECT = securityTokenHash.digest('hex');
                req.body.config.installed = true;

                // check if data folder exists, if not create it
                fileHelper.createFolder(process.env.STJORNA_SERVER_STORAGE);

                // create initial config file
                fileHelper.saveConfigFile(req.body.config, (err, config) => {
                    if (err) {
                        logger.error(`error occured: ${err.message}`);
                        responseMessage.config_status.errors.push(err.message);
                    } else {
                        logger.log('debug', `configuration saved`);
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
                    language: req.body.user.language,
                    created: new Date().getTime(),
                    updated: new Date().getTime(),
                };

                dbHelper.db
                    .get('users')
                    .push(newItem)
                    .write()
                    .then(() => {
                        logger.log('debug', `user '${req.body.user.username}' added`);
                    });

                // send response to frontend
                if (responseMessage.config_status.errors.length > 0 || responseMessage.user_status.errors.length > 0) {
                    logger.error(`configuration - ${responseMessage}`);
                    res.status(400).send({ message: responseMessage, status: 'error' });
                } else {
                    logger.info('configuration sucessfully written');
                    res.send({ message: responseMessage, status: 'ok' });
                }
            } else {
                // config file is existing, prevent possible overwriting
                logger.warn('configuration - file is already existing, do not proceed');
                res.status(400).send({ message: 'configuration is already existing', status: 'warn' });
            }
        });
};
