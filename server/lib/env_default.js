module.exports = {
    initialize: () => {
        // application startup parameters
        process.env['STJORNA_SERVER_PORT']                  = process.env.STJORNA_SERVER_PORT               || 3000;
        process.env['STJORNA_SERVER_MAX_UPLOAD']            = process.env.STJORNA_SERVER_MAX_UPLOAD         || '8mb';
        process.env['STJORNA_LOGLEVEL']                     = process.env.STJORNA_LOGLEVEL                  || 'info';
        process.env['STJORNA_REQUEST_LOG']                  = process.env.STJORNA_REQUEST_LOG               || '';
        process.env['STJORNA_CRON_CLEANUP_INTERVAL']        = process.env.STJORNA_CRON_CLEANUP_INTERVAL     || '00 3 * * *';
        process.env['STJORNA_SERVER_STORAGE']               = process.env.STJORNA_SERVER_STORAGE            || `${process.cwd()}/data`;
        process.env['STJORNA_DATABASE_TYPE']                = process.env.STJORNA_DATABASE_TYPE             || `lowdb`;
        // process.env['STJORNA_DATABASE_HOST']                = process.env.STJORNA_DATABASE_HOST             || `localhost`;
        // process.env['STJORNA_DATABASE_PORT']                = process.env.STJORNA_DATABASE_PORT             || 28015;
        // process.env['STJORNA_DATABASE']                     = process.env.STJORNA_DATABASE                  || 'stjorna';
        // process.env['STJORNA_DATABASE_USER']                = process.env.STJORNA_DATABASE_USER             || 'stjorna';
        // process.env['STJORNA_DATABASE_PASSWORD']            = process.env.STJORNA_DATABASE_PASSWORD         || 'stjorna';
        
        // configuration default values
        process.env['STJORNACONFIG_PASSWORD_SECRECT']       = process.env.STJORNACONFIG_PASSWORD_SECRECT    || '';
        process.env['STJORNACONFIG_ALLOW_REMOTE_ACCESS']    = process.env.STJORNACONFIG_ALLOW_REMOTE_ACCESS || false;
        process.env['STJORNACONFIG_IMAGE_DIMENSION']        = process.env.STJORNACONFIG_IMAGE_DIMENSION     || 700;
        process.env['STJORNACONFIG_IMAGE_QUALITY']          = process.env.STJORNACONFIG_IMAGE_QUALITY       || 70;
        process.env['STJORNACONFIG_INSTALLED']              = process.env.STJORNACONFIG_INSTALLED           || false;
    },
    isProduction: () => {
        return process.env.NODE_ENV === 'production';
    }
};
