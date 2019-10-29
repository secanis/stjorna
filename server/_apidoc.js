/**
 * @api {get} /api/v1/settings Get Settings
 * @apiPrivate
 * @apiName GetSettings
 * @apiGroup Settings
 * @apiPermission loggedin
 * @apiVersion 1.0.0
 *
 * @apiSuccess {string} password_secret Returns Settings object
 * @apiSuccess {boolean} allow_remote_access Returns Settings object
 * @apiSuccess {string} image_dimension Returns Settings object
 * @apiSuccess {string} image_quality Get the value of password quality
 */