// load stjorna environment
const stjornaEnv = require('./lib/env_default.cjs');
stjornaEnv.initialize();
// load library/server stuff for startup
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

// configuration file
const appInfo = require('./package.json');
const app = express();
const logger = require('./lib/logging_helper.cjs');

// initialize databases
require('./lib/database_helper.cjs').initialize();

// initialize tracking
require('./lib/tracking_helper.cjs').initialize();

// initialize bodyParser ans set limits
app
    .use(bodyParser.json({ limit: process.env.STJORNA_SERVER_MAX_UPLOAD }))
    .use(bodyParser.urlencoded({ limit: process.env.STJORNA_SERVER_MAX_UPLOAD, extended: true }));

// initialize request logging
app.use(logger.configureExpressLogging);

// setup routing
// whitelisted routes
require('./api/routes_auth.cjs')(router);

// secure (not whitelisted) routes
require('./api/routes_user.cjs')(router);
require('./api/routes_categories.cjs')(router);
require('./api/routes_products.cjs')(router);
require('./api/routes_services.cjs')(router);
require('./api/routes_data.cjs')(router);
require('./api/routes_info.cjs')(router);
require('./api/routes_settings.cjs')(router);

// static routes
app.use('/api', router);
app.use(express.static(`${__dirname}/public`));
app.use('/apidoc', express.static(`${__dirname}/apidoc`));

app.get('*', (req, res) => {
    res.sendFile(`${__dirname}/public/index.html`);
});

// do needed migrations
const migration = require('./migration/migration.cjs');
migration.executeMigrations();

// initialize cron jobs
setTimeout(() => {
    require('./cronjobs/cleanup_uploads.cjs')();
    require('./cronjobs/generate_tumbnails.cjs')();
}, 1000);

// start application
module.exports = app.listen(process.env.STJORNA_SERVER_PORT);
logger.logger.info(`app   :  ${appInfo.name}:${appInfo.version}`);
logger.logger.info(`port  :  ${process.env.STJORNA_SERVER_PORT}`);
// print configuration
logger.logger.info(`production mode enabled: ${stjornaEnv.isProduction()}`);
logger.logger.info(`configuration from ${process.env.STJORNA_SERVER_STORAGE}/config.json`);
logger.logger.info(`cleanup interval ${process.env.STJORNA_CRON_CLEANUP_INTERVAL}`);
logger.logger.info(`thumbnail interval ${process.env.STJORNA_CRON_THUMBNAIL_INTERVAL}`);
