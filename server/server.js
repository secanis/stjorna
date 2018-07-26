require('./lib/env_default.js');
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
// configuration file
const appInfo = require(`./package.json`);
// default loglevel
const log = require('node-logging');
log.setLevel(process.env.STJORNA_LOGLEVEL);

const app = express();

// initialize databases
require('./lib/database_helper').initialize(log);

// initialize cron jobs
require('./cronjobs/cleanup_uploads')(log);

// initialize bodyParser ans set limits
app.use(bodyParser.json({limit: process.env.STJORNA_SERVER_MAX_UPLOAD}));
app.use(bodyParser.urlencoded({limit: process.env.STJORNA_SERVER_MAX_UPLOAD, extended: true}));

// initialize request logging
app.use(log.requestLogger);

// setup routing
// whitelisted routes
require('./api/routes_auth')(router, log);

// secure (not whitelisted) routes
require('./api/routes_user')(router, log);
require('./api/routes_categories')(router, log);
require('./api/routes_products')(router, log);
require('./api/routes_data')(router, log);
require('./api/routes_info')(router, log);
require('./api/routes_user')(router, log);
require('./api/routes_settings')(router, log);

// static routes
app.use('/api', router);
app.use(express.static(`${__dirname}/public`));
app.use('/apidoc', express.static(`${__dirname}/apidoc`));

app.get('*', (req, res) => {
    res.sendFile(`${__dirname}/public/index.html`);
});

// start application
module.exports = app.listen(process.env.STJORNA_SERVER_PORT);
log.inf(`>> app   -  ${appInfo.name}:${appInfo.version}`);
log.inf(`>> port  -  ${process.env.STJORNA_SERVER_PORT}`);
// print configuration
log.inf(`>> configuration from ${process.env.STJORNA_SERVER_STORAGE}/config.json`);
log.inf(`>> cleanup interval ${process.env.STJORNA_CRON_CLEANUP_INTERVAL}`);
