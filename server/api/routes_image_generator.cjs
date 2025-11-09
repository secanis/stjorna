const logger = require('../lib/logging_helper.cjs').logger;
const imageGenerator = require('../lib/image_generator.cjs');

module.exports = (router) => {
    router
        .route('/v1/generate-image')
        /**
         * @api {post} /api/v1/generate-image Generate Placeholder Image
         * @apiName GenerateImage
         * @apiGroup Image
         * @apiPermission loggedin
         * @apiVersion 1.0.0
         * 
         * @apiDescription Generate a placeholder image with customizable dimensions, text, and colors.
         * This is useful for creating temporary images for products or categories that don't have images yet.
         *
         * @apiParam {Number} [width=800] Width of the generated image in pixels
         * @apiParam {Number} [height=600] Height of the generated image in pixels
         * @apiParam {String} [text="Placeholder"] Text to display on the image
         * @apiParam {String} [backgroundColor="#cccccc"] Background color in hex format
         * @apiParam {String} [textColor="#333333"] Text color in hex format
         * @apiParam {String} [format="jpeg"] Image format: 'jpeg' or 'png'
         * @apiParam {String} [category="products"] Category for storage: 'products' or 'categories'
         *
         * @apiSuccess {String} imageUrl URL path to the generated image
         * @apiSuccess {String} message Success message
         * @apiSuccess {Object} details Generation details including dimensions and format
         *
         * @apiError (Error 400) {String} message Error message
         * @apiError (Error 400) {String} status Error status
         */
        .post(async (req, res) => {
            try {
                const options = {
                    width: req.body.width ? parseInt(req.body.width) : 800,
                    height: req.body.height ? parseInt(req.body.height) : 600,
                    text: req.body.text || 'Placeholder',
                    backgroundColor: req.body.backgroundColor || '#cccccc',
                    textColor: req.body.textColor || '#333333',
                    format: req.body.format || 'jpeg',
                    userid: req.headers['x-stjorna-userid'],
                    category: req.body.category || 'products'
                };

                // Validate dimensions
                if (options.width < 1 || options.width > 4000) {
                    return res.status(400).send({
                        message: 'Width must be between 1 and 4000 pixels',
                        status: 'error'
                    });
                }

                if (options.height < 1 || options.height > 4000) {
                    return res.status(400).send({
                        message: 'Height must be between 1 and 4000 pixels',
                        status: 'error'
                    });
                }

                logger.log('debug', `image_generator - generating placeholder image: ${options.text} (${options.width}x${options.height})`);

                const imageUrl = await imageGenerator.generatePlaceholderImage(options);

                res.send({
                    imageUrl: imageUrl,
                    message: 'Image generated successfully',
                    details: {
                        width: options.width,
                        height: options.height,
                        text: options.text,
                        format: options.format,
                        category: options.category
                    }
                });
            } catch (error) {
                logger.error(`image_generator - error: ${error.message}`);
                res.status(400).send({
                    message: `Failed to generate image: ${error.message}`,
                    status: 'error'
                });
            }
        });
};
