const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const logger = require('../lib/logging_helper.js').logger;
const exportExcel = require('./export/excel.js');
const exportJson = require('./export/json.js');

module.exports = {
    getFolderContent: (route, cb) => {
        // build a complete file tree of all things within a route, base route is /<data>/uploads/<username>
        let files = fs.readdir(route, 'utf8', (err, files) => {
            let fileList = [];
            if (files) {
                for (let file of files) {
                    let extension = path.extname(file);
                    let fileSizeInBytes = 0;
                    if (extension) {
                        fileSizeInBytes = fs.statSync(`${route}/${file}`).size;
                    }
                    fileList.push({ name: file, extension, fileSizeInBytes });
                }
                cb(err, fileList);
            } else {
                cb({ message: 'got an empty file list' }, fileList);
            }
        });
    },
    matchFileWithListOfObjects: (path, files, docs, docsAttr, deleteOnMatch) => {
        // search a file in a list of objects by the doc attributes
        if (deleteOnMatch === null || deleteOnMatch === undefined) {
            deleteOnMatch = false;
        }
        files.forEach((file) => {
            let match = false;
            // iterate over all documents and match the filename
            docs.forEach((doc) => {
                if (doc[docsAttr] && doc[docsAttr].includes(file.name.replace(file.extension, '').replace('.thumbnail', ''))) {
                    match = true;
                    return;
                }
            });
            // remove file, when it not exists
            if (deleteOnMatch && !match) {
                module.exports.removeFile(path, file.name);
            }
        });
    },
    generateImageTypeJpeg: async (basePath, file) => {
        const targetThumnailJpegPath = `${basePath}/${file.name.replace(file.extension, `.thumbnail.jpeg`)}`;
        const pathThumbnailExists = fs.existsSync(targetThumnailJpegPath);

        if (!pathThumbnailExists) await sharp(`${basePath}/${file.name}`).resize(100, 100).toFile(targetThumnailJpegPath);
    },
    generateImageTypeWebP: async (basePath, file) => {
        module.exports.loadConfigFile(async (err, c) => {
            if (c) c = JSON.parse(c);

                if (err) {
                logger.error(err.message, 'failed to read config file');
                return;
            }
            const targetWebpPath = `${basePath}/${file.name.replace(file.extension, `.webp`)}`;
            const targetThumnailWebpPath = `${basePath}/${file.name.replace(file.extension, `.thumbnail.webp`)}`;

            const pathExists = fs.existsSync(targetWebpPath);
            const pathThumbnailExists = fs.existsSync(targetThumnailWebpPath);

            if (!pathExists && c) await sharp(`${basePath}/${file.name}`).resize(c.image.width, c.image.height).toFile(targetWebpPath);
            if (!pathThumbnailExists) await sharp(`${basePath}/${file.name}`).resize(100, 100).toFile(targetThumnailWebpPath);
        });
    },
    removeFile: (path, filename) => {
        // delete a file by path and filename
        fs.unlink(`${path}/${filename}`, (err, result) => {
            if (!err) {
                logger.info(`cronjob - cleanup_uploads - deleted file: ${filename}`);
            } else {
                logger.error(`cronjob - cleanup_uploads - delete file failed: ${err.message}`);
            }
        });
    },
    createFolder: (dir) => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
    },
    loadConfigFile: (cb) => {
        // load config file and call the cb
        fs.readFile(`${process.env.STJORNA_SERVER_STORAGE}/config.json`, 'utf8', cb);
    },
    saveConfigFile: (newConf, cb) => {
        // save config file by a model and call the cb
        module.exports.loadConfigFile((err, obj) => {
            let existConf = {};
            if (!err && obj) {
                existConf = JSON.parse(obj);
            }
            newConf.allow_remote_access = JSON.parse(newConf.allow_remote_access);
            // set the values from the parameter object or set it from the existing configuration
            // if not given or set the defaults from the env_defaults
            let configObj = {
                password_secret: existConf.password_secret || process.env.STJORNACONFIG_PASSWORD_SECRECT,
                allow_remote_access: null,
                image: {
                    width: (newConf.image && newConf.image.width) || (existConf.image && existConf.image.width) || process.env.STJORNACONFIG_IMAGE_WIDTH,
                    height: (newConf.image && newConf.image.height) || (existConf.image && existConf.image.height) || process.env.STJORNACONFIG_IMAGE_HEIGHT,
                    quality: (newConf.image && newConf.image.quality) || (existConf.image && existConf.image.quality) || process.env.STJORNACONFIG_IMAGE_QUALITY,
                },
                installed: newConf.installed || existConf.installed || process.env.STJORNACONFIG_INSTALLED,
            };
            // evaluate if which configuration we have
            if (newConf && newConf.allow_remote_access !== null && newConf.allow_remote_access !== undefined) {
                configObj.allow_remote_access = newConf.allow_remote_access;
            } else if (existConf && existConf.allow_remote_access !== null && existConf.allow_remote_access !== undefined) {
                configObj.allow_remote_access = existConf.allow_remote_access;
            } else {
                configObj.allow_remote_access = process.env.STJORNACONFIG_ALLOW_REMOTE_ACCESS;
            }
            fs.writeFile(`${process.env.STJORNA_SERVER_STORAGE}/config.json`, JSON.stringify(configObj, null, 4), 'utf8', (err) => {
                cb(err, configObj);
            });
        });
    },
    isConfigFileExisting: () => {
        return module.exports.isFileExisting(`${process.env.STJORNA_SERVER_STORAGE}/config.json`);
    },
    isFileExisting: (filePath) => {
        fs.stat(filePath, (err, stat) => {
            if (!err) {
                // file exists
                return true;
            } else {
                return false;
            }
        });
    },
    gernerateExport: (exportType, cb) => {
        switch (exportType) {
            case 'excel':
                exportExcel.generateExport(cb);
                break;
            case 'json':
                exportJson.generateExport(cb);
                break;

            default:
                cb(
                    {
                        message: 'not matching export type',
                    },
                    null
                );
                break;
        }
    },
};
