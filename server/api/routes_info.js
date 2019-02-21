const os = require('os');

const dbHelper = require('../lib/database_helper.js');

// configuration file
const appInfo = require('../package.json');
const logger = require('../lib/logging_helper.js').logger;

module.exports = (router, log) => {
    router.route('/v1/info/server')
        /**
         * @api {get} /api/v1/info/server Get Host Information
         * @apiPrivate
         * @apiName GetServerInfo
         * @apiGroup Info
         * @apiPermission loggedin
         * @apiVersion 1.0.1
         * 
         * @apiSuccess {String} hostname Hostname
         * @apiSuccess {String} api_port Node port
         * @apiSuccess {String} os Host operating system
         * @apiSuccess {String} arch Host operating system architecture
         * @apiSuccess {String} mem_total Host total installed memory
         * @apiSuccess {String} mem_free Host total free memory
         * @apiSuccess {String} cpu Host type of cpu
         * @apiSuccess {String} loadavg Host avarage system cpu load
         */
        .get((req, res) => {
            try {
                logger.log('debug', `info - load host information`);
                // prepare load values
                let loadString = '';
                os.loadavg().forEach((v,i) => {
                    if (i > 0) loadString += ' | ';
                    loadString += `${v * 100}%`;
                });

                // prepare database infos
                let dbInfo = dbHelper.getAllDataSets();
                dbHelper.getAllDataSetMembers().forEach((entry) => {
                    dbInfo[entry] = dbHelper.getSizeOfDataSet(entry);
                });
                let obj = {
                    'hostname': `${os.hostname()}`,
                    'api_port': `${process.env.STJORNA_SERVER_PORT}`,
                    'os': `${os.type()} ${os.release()}`,
                    'arch': `${os.arch()}`,
                    'mem_total': os.totalmem(),
                    'mem_free': os.freemem(),
                    'cpu': `${os.cpus()[0].model}`,
                    // loadavg does not work on windows systems
                    'loadavg': `${loadString}`,
                    'app_version': `${appInfo.name}:${appInfo.version}`,
                    'database': {
                        type: process.env.STJORNA_DATABASE_TYPE,
                        constellations: dbInfo
                    }
                };
                res.send(obj);
            } catch (err) {
                logger.error(`info - error while loading server info: ${err.message}`);
                res.status(500).send({ "message": err.message, "status": "error" });
            }
        });

    router.route('/v1/info/config')
        /**
         * @api {get} /api/v1/info/config Get NodeJS ENV Config
         * @apiPrivate
         * @apiName GetNodeServerEnv
         * @apiGroup Info
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         * 
         * @apiSuccess {String[]} environment NodeJS environment configuration ("STJORNA_" variables)
         */
        .get((req, res) => {
            let env = process.env;
            const serverEnv = [];
            logger.log('debug', `info - load environment configuration`);
            Object.keys(env)
                .filter((key) => key.includes('STJORNA_'))
                .reduce((obj, key) => {
                    serverEnv.push({
                        name: key,
                        value: env[key]
                    });
                }, {});

            res.send(serverEnv);
        });
};