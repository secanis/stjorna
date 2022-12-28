const fs = require('fs');

let formidable;
(async () => {
    formidable = await import('formidable');
})();

const importZip = require('./import/zip.cjs');
const database_helper = require('./database_helper.cjs');

const DIR_PATH = `${process.env.STJORNA_SERVER_STORAGE}/temp`;
let FILE_PATH;

module.exports = {
    getForm: (req) => {
        const form = new formidable.IncomingForm({ multiples: false, uploadDir: DIR_PATH });
        form.parse(req);

        form.on('fileBegin', (name, file) => {
            database_helper.createRquiredFolders();
            if (!fs.existsSync(DIR_PATH)) {
                fs.mkdirSync(DIR_PATH);
            }
            FILE_PATH = `${DIR_PATH}/${file.name}`;
            file.path = FILE_PATH;
        });

        return form;
    },
    extractZip: async () => {
        await importZip.unpackDatabase(FILE_PATH, process.env.STJORNA_SERVER_STORAGE);
    }
};
