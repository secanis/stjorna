const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const logger = require('../lib/logging_helper.js').logger;
const stjornaEnv = require('../lib/env_default.js');
const dbHelper = require('../lib/database_helper.js');
const fileHelper = require('../lib/file_helper.js');

// general error handling when no api key is there
let errorHandlingNoApiKey = (req, res) => {
    logger.error(`login - E105: no token or userid & apikey provided`);
    res.status(401).send({ message: 'E105: no token or userid & apikey provided.', status: 'error' });
}

module.exports = (router) => {
    // set controll allow origin header
    router.use((req, res, next) => {
        // answer to OPTIONS requests
        if (req.method === 'OPTIONS') {
            var headers = {};
            headers["Access-Control-Allow-Origin"] = "*";
            headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
            headers["Access-Control-Allow-Credentials"] = false;
            headers["Access-Control-Max-Age"] = '86400';
            headers["Access-Control-Allow-Headers"] = "x-stjorna-access-token,x-stjorna-userid,x-stjorna-apikey,X-Requested-With,X-HTTP-Method-Override,content-type,content-disposition,accept";

            res.writeHead(200, headers);
            res.send();
        } else {
            // allow more stuff in development mode
            if (!stjornaEnv.isProduction()) {
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
                res.setHeader('Access-Control-Allow-Headers', 'x-stjorna-access-token,x-stjorna-userid,X-Requested-With,content-type,content-disposition');
                res.setHeader('Access-Control-Allow-Credentials', true);
            } else {
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
                res.setHeader('Access-Control-Allow-Headers', 'x-stjorna-access-token,x-stjorna-userid,x-stjorna-apikey,X-Requested-With,content-type,content-disposition');
            }
            next();
        }
    });

    router.route('/v1/authenticate')
        .post((req, res) => {
            fileHelper.loadConfigFile((err, config) => {
                if (!err) {
                    let stjornaConfig = JSON.parse(config);
                    let hash = crypto.createHash('sha512');
                    hash.update(req.body.password + stjornaConfig.password_secret);
                    hash = hash.digest('hex');
                    let user = dbHelper.db.get('users').find({ username: req.body.username, password: hash }).value();
                    if (user) {
                        var token = jwt.sign(user, stjornaConfig.password_secret, {
                            expiresIn: '12h'
                        });
                        logger.info(`login - succesful for ${req.body.username} - ${req.ip}`);
                        res.send({
                            "status": "successful",
                            "message": "have fun and enjoy life...",
                            "_id": user._id,
                            "username": req.body.username,
                            "email": user.email,
                            "language": user.language,
                            "token": token
                        });
                    } else {
                        if (!user) {
                            logger.error(`login - E101: invalid login credential - ${req.body.username} - ${req.ip}`);
                            res.status(401).send({
                                "status": "failed",
                                "message": "E101: invalid login credentials",
                                "username": req.body.username,
                                "token": null
                            });
                        } else {
                            logger.error(`login - error occured: ${err.message}`);
                            res.status(400).send({ "message": err.message, "status": "error" });
                        }
                    }
                } else {
                    errorHandlingNoApiKey(req, res);
                }
            });
        });

    router.route('/v1/authenticate/verify')
        .post((req, res) => {
            let token = req.body.token || req.query.token || req.headers['x-stjorna-access-token'];
            if (token) {
                fileHelper.loadConfigFile((err, config) => {
                    if (!err) {
                        let stjornaConfig = JSON.parse(config);
                        jwt.verify(token, stjornaConfig.password_secret, (err, decoded) => {
                            if (err) {
                                logger.error(`login - E102: failed to authenticate token. your token is invalid - ${req.ip}`);
                                res.status(401).send({
                                    message: 'E102: failed to authenticate token. your token is invalid.', status: 'error'
                                });
                            } else {
                                req.decoded = decoded;
                                res.send({
                                    message: 'your token is vaild.', status: 'inf'
                                });
                            }
                        });
                    } else {
                        logger.error(`login - error occured: ${err.message}`);
                        res.status(403).send({ "message": 'E114: You are not authenticated, please login.', "status": "error" });
                    }
                });
            } else {
                errorHandlingNoApiKey(req, res);
            }
        });

    // set login controller
    router.use((req, res, next) => {
        let token = req.query.token || req.headers['x-stjorna-access-token'];
        let apikey = req.query.apikey || req.headers['x-stjorna-apikey'];
        let userid = req.query.userid || req.headers['x-stjorna-userid'];

        if (token && userid) {
            fileHelper.loadConfigFile((err, config) => {
                if (!err) {
                    let stjornaConfig = JSON.parse(config);
                    jwt.verify(token, stjornaConfig.password_secret, (err, decoded) => {
                        if (err) {
                            logger.error(`login - E104: failed to authenticate token.`);
                            res.status(401).send({ message: 'E104: failed to authenticate token.', status: 'error' });
                        } else {
                            req.decoded = decoded;
                            next();
                        }
                    });
                } else {
                    logger.error(`login - error occured: ${err.message}`);
                    res.status(401).send({ 'message': 'E113: error occured, please try again.', 'status': 'error' });
                }
            });
        } else if (apikey && userid) {
            fileHelper.loadConfigFile((err, config) => {
                if (!err) {
                    let stjornaConfig = JSON.parse(config);
                    if (stjornaConfig.allow_remote_access) {
                        let user = dbHelper.db.get('users').find({ _id: userid, apikey: apikey }).value();
                        if (user) {
                            logger.info(`login - apikey access for ${userid} - ${req.ip} - ${req.path}`);
                            // ruleset for whitelisted paths (setup is configured in else part)
                            if (req.method === 'GET' && (
                                    req.path.includes('products') || 
                                    req.path.includes('categories') ||
                                    req.path.includes('uploads')
                            )) {
                                next();
                            } else {
                                logger.error(`login - E106: not valid HTTP method or could not access route.`);
                                res.status(401).send({ message: 'E106: not valid HTTP method or could not access route.', status: 'error' });
                            }
                        } else {
                            if (!user) {
                                logger.error(`login - E107: invalid apikey credentials - ${userid}`);
                                res.status(401).send({
                                    'status': 'failed',
                                    'message': 'E107: invalid apikey credentials',
                                    userid,
                                    apikey
                                });
                            } else {
                                logger.error(`login - error occured: ${err.message}`);
                                res.status(400).send({ "message": err.message, "status": "error" });
                            }
                        }
                    } else {
                        logger.error(`login - E108: config "allow_remote_access" is "false"`);
                        res.status(403).send({ "message": "E108: please contact the administrator, not allowed.", "status": "error" });
                    }
                } else {
                    logger.error(`login - error occured: ${err.message}`);
                    res.status(400).send({ 'message': err, 'status': 'error' });
                }
            });
        // special handling for test mode, or if you want to run it without security
        } else if (process.env.NODE_ENV === 'test' && process.env.STJORNA_SECURITY === 'none') {
            next();
        } else {
            // if it is the setup path and the config installed flag is not on false, route the stuff
            if (req.path.includes('setup')) {
                fileHelper.loadConfigFile((err, config) => {
                    if (err || !JSON.parse(config).installed) {
                        next();
                    } else {
                        res.send({ 'message': 'installation done', 'status': 'ok' });
                    }
                });
            } else {
                errorHandlingNoApiKey(req, res);
            }
        }
    });
};
