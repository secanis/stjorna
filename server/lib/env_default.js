module.exports = {
    initialize: () => {
        // application startup parameters
        process.env['STJORNA_SERVER_PORT']                  = process.env.STJORNA_SERVER_PORT               || 3000;
        process.env['STJORNA_SERVER_MAX_UPLOAD']            = process.env.STJORNA_SERVER_MAX_UPLOAD         || '5mb';
        process.env['STJORNA_LOGLEVEL']                     = process.env.STJORNA_LOGLEVEL                  || 'info';
        process.env['STJORNA_CRON_CLEANUP_INTERVAL']        = process.env.STJORNA_CRON_CLEANUP_INTERVAL     || '00 3 * * *';
        process.env['STJORNA_SERVER_STORAGE']               = process.env.STJORNA_SERVER_STORAGE            || `${process.cwd()}/data`;
        
        // configuration default values
        process.env['STJORNACONFIG_PASSWORD_SECRECT']       = process.env.STJORNACONFIG_PASSWORD_SECRECT    || '';
        process.env['STJORNACONFIG_ALLOW_REMOTE_ACCESS']    = process.env.STJORNACONFIG_ALLOW_REMOTE_ACCESS || false;
        process.env['STJORNACONFIG_IMAGE_DIMENSION']        = process.env.STJORNACONFIG_IMAGE_DIMENSION     || 350;
        process.env['STJORNACONFIG_IMAGE_QUALITY']          = process.env.STJORNACONFIG_IMAGE_QUALITY       || 70;
        process.env['STJORNACONFIG_INSTALLED']              = process.env.STJORNACONFIG_INSTALLED           || false;
    },
    isProduction: () => {
        return process.env.NODE_ENV === 'production';
    }
};
