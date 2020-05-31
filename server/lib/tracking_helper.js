const PiwikTracker = require('piwik-tracker');
const logger = require('../lib/logging_helper.js').logger;

let matomo;

function initialize() {
    const matomoPageId = process.env.STJORNA_MATOMOID;
    const matomoUrl = process.env.STJORNA_MATOMOURL;
    const matomoToken = process.env.STJORNA_MATOMOTOKEN;

    if (matomoPageId && matomoUrl) {
        logger.info(`setup matomo tracking to instance: ${matomoUrl}`);
        logger.info(`setup matomo tracking for page: ${matomoPageId}`);
        if (matomoToken) {
            logger.info(`matomo token was set, enabled IP tracking`);
        } else {
            logger.warn('no matomo token configured, skip IP tracking');
        }
        matomo = new PiwikTracker(matomoPageId, matomoUrl);
    } else {
        logger.warn(
            'no matomo instance configured, skip api tracking setup'
        );
    }
}

function getRemoteAddr(req) {
    if (req.ip) return req.ip;
    if (req._remoteAddress) return req._remoteAddress;
    var sock = req.socket;
    if (sock.socket) return sock.socket.remoteAddress;
    return sock.remoteAddress;
}

function apiTrack(req, action, contentInfo) {
    const matomoToken = process.env.STJORNA_MATOMOTOKEN;
    let trackObj = {
        url: `${req.header.origin}${req.baseUrl}${req.url}`,
        action_name: action,
        ua: req.header('User-Agent'),
        lang: req.header('Accept-Language'),
        c_n: contentInfo.c_n,
        c_p: contentInfo.c_p,
        c_t: contentInfo.c_t,
        cvar: JSON.stringify({
            '1': ['API version', 'v1'],
            '2': ['HTTP method', req.method],
        }),
    };

    if (matomoToken) {
        trackObj['token_auth'] = matomoToken;
        trackObj['cip'] = getRemoteAddr(req);
    }

    matomo.track(trackObj);
}

module.exports = {
    initialize,
    apiTrack,
};
