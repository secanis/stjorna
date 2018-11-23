// load stjorna environment
const stjornaEnv = require('./lib/env_default.js');
stjornaEnv.initialize();
// load library/server stuff for startup
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

// configuration file
const appInfo = require(`./package.json`);
const app = express();
const http = require('http').Server(app);
const logger = require('./lib/logging_helper.js');

// initialize databases
require('./lib/database_helper').initialize();

// initialize socket/stream
require('./lib/socket_helper').initalize(http);

// initialize cron jobs
require('./cronjobs/cleanup_uploads')();

// initialize bodyParser ans set limits
app.use(bodyParser.json({ limit: process.env.STJORNA_SERVER_MAX_UPLOAD }));
app.use(bodyParser.urlencoded({ limit: process.env.STJORNA_SERVER_MAX_UPLOAD, extended: true }));

// initialize request logging
app.use(logger.configureExpressLogging);

// setup routing
// whitelisted routes
require('./api/routes_auth')(router);

// secure (not whitelisted) routes
require('./api/routes_user')(router);
require('./api/routes_categories')(router);
require('./api/routes_products')(router);
require('./api/routes_data')(router);
require('./api/routes_info')(router);
require('./api/routes_settings')(router);

// static routes
app.use('/api', router);
app.use(express.static(`${__dirname}/public`));
app.use('/apidoc', express.static(`${__dirname}/apidoc`));

app.get('*', (req, res) => {
    res.sendFile(`${__dirname}/public/index.html`);
});

// start application
module.exports = http.listen(process.env.STJORNA_SERVER_PORT);
logger.logger.info(`>> app   :  ${appInfo.name}:${appInfo.version}`);
logger.logger.info(`>> port  :  ${process.env.STJORNA_SERVER_PORT}`);
// print configuration
logger.logger.info(`>> production mode enabled: ${stjornaEnv.isProduction()}`);
logger.logger.info(`>> configuration from ${process.env.STJORNA_SERVER_STORAGE}/config.json`);
logger.logger.info(`>> cleanup interval ${process.env.STJORNA_CRON_CLEANUP_INTERVAL}`);
