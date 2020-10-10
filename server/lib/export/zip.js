const fsTemp = require('fs-temp');
const fs = require('fs');
const archiver = require('archiver');
const logger = require('../../lib/logging_helper.js').logger;

module.exports = {
    generateExport: (cb) => {
        const output = fsTemp.template(`stjorna-backup-${Date.now()}%s`).createWriteStream();
        const archive = archiver('zip');
        let path;

        output.on('path', p => path = p);
        output.on('close', () => {
            logger.info(archive.pointer() + ' total bytes');
            logger.info('archive process has finished');
            cb(null, {
                contentType: 'application/zip',
                file: fs.readFileSync(path),
                fileSuffix: 'zip'
            });
        });

        archive.on('error', (err) => {
            logger.error(`${err.message}\n${err.stack}`);
            cb({
                message: err.message,
                status: 'error'
            }, null);
        });

        archive.pipe(output);

        archive.directory(process.env.STJORNA_SERVER_STORAGE, false);
        archive.finalize();
    }
};
