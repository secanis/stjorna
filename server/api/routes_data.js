const fs = require('fs');

const fileHelper = require('../lib/file_helper.js');

module.exports = (router, log) => {
    router.route('/data/uploads/:userid/:additionalPath?')
        /**
         * @api {get} /api/data/uploads/:userid/:additionalPath? Get Image List
         * @apiName GetListImages
         * @apiGroup Data
         * @apiPermission token/apikey
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} userid users unique ID.
         * @apiParam {String} [additionalPath] additonal path to a binary file
         *
         * @apiSuccess {String[]} Data Returns a list of uploaded data (normally an images).
         */
        .get((req, res) => {
            let additionalPath = '';
            if (req.params.additionalPath) {
                additionalPath = `/${req.params.additionalPath}`
            }
            // check if there are wanted "autentication" methods for binary data
            if ((req.query.userid || req.headers['x-stjorna-userid']) == req.params.userid) {
                fileHelper.getFolderContent(`${process.env.STJORNA_SERVER_STORAGE}/uploads/${req.params.userid}${additionalPath}`, (err, data) => {
                    if (!err) {
                        res.send(data);
                    } else {
                        log.err(`error occured: ${err.message}`);
                        res.status(500).send({ 'message': err.message, 'status': 'error' });
                    }
                });
            } else {
                res.status(401).send({ 'message': 'no permissions for this ressource.', 'status': 'error' });
            }
        });

    router.route('/data/uploads/:userid/:additionalPath?/:image')
        /**
         * @api {get} /api/data/uploads/:userid/:additionalPath?/:image Get Image
         * @apiName GetImage
         * @apiGroup Data
         * @apiPermission token/apikey
         * @apiVersion 1.0.0
         * 
         * @apiParam {String} userid users unique ID.
         * @apiParam {String} [additionalPath] additonal path to a binary file
         * @apiParam {String} image image file name to load
         *
         * @apiSuccess {Data} Data Returns an image (jpeg)
         */
        .get((req, res) => {
            // check if there are wanted "autentication" methods for binary data
            if ((req.query.userid || req.headers['x-stjorna-userid']) == req.params.userid) {               
                let additionalPath = '';
                if (req.params.additionalPath) {
                    additionalPath = `/${req.params.additionalPath}`
                }
                try {
                    res.sendFile(`${process.env.STJORNA_SERVER_STORAGE}/uploads/${req.params.userid}${additionalPath}/${req.params.image}`);
                } catch(err) {
                    log.err(`error occured: ${err.message}`);
                    res.status(500).send({ 'message': err.message, 'status': 'error' });
                }
            } else {
                res.status(401).send({ 'message': 'no permissions for this ressource.', 'status': 'error' });
            }
        });
}