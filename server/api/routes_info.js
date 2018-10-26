const os = require('os');

// configuration file
const appInfo = require(`../package.json`);

module.exports = (router, log) => {
    router.route('/v1/info/server')
        /**
         * @api {get} /api/v1/info/server Get Host Information
         * @apiPrivate
         * @apiName GetServerInfo
         * @apiGroup Info
         * @apiPermission loggedin
         * @apiVersion 1.0.0
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
                let obj = {
                    'hostname': `${os.hostname()}`,
                    'api_port': `${process.env.STJORNA_SERVER_PORT}`,
                    'os': `${os.type()} ${os.release()}`,
                    'arch': `${os.arch()}`,
                    'mem_total': os.totalmem(),
                    'mem_free': os.freemem(),
                    'cpu': `${os.cpus()[0].model}`,
                    // loadavg does not work on windows systems
                    'loadavg': `${os.loadavg()}`,
                    'app_version': `${appInfo.name}:${appInfo.version}`
                };
                res.send(obj);
            } catch (err) {
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