const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const logger = require('./logging_helper.cjs').logger;
const fileHelper = require('./file_helper.cjs');

/**
 * Generate a placeholder image with text overlay
 * @param {Object} options - Image generation options
 * @param {number} options.width - Image width (default: 800)
 * @param {number} options.height - Image height (default: 600)
 * @param {string} options.text - Text to overlay (default: 'Placeholder')
 * @param {string} options.backgroundColor - Background color (default: '#cccccc')
 * @param {string} options.textColor - Text color (default: '#333333')
 * @param {string} options.format - Image format: 'jpeg' or 'png' (default: 'jpeg')
 * @param {string} options.userid - User ID for storage path
 * @param {string} options.category - Category for storage: 'products' or 'categories' (default: 'products')
 * @returns {Promise<string>} - Path to the generated image
 */
module.exports.generatePlaceholderImage = async (options) => {
    try {
        // Set defaults
        const width = options.width || 800;
        const height = options.height || 600;
        const text = options.text || 'Placeholder';
        const backgroundColor = options.backgroundColor || '#cccccc';
        const textColor = options.textColor || '#333333';
        const format = options.format || 'jpeg';
        const userid = options.userid;
        const category = options.category || 'products';

        // Validate format
        if (format !== 'jpeg' && format !== 'png') {
            throw new Error('Format must be either jpeg or png');
        }

        // Create SVG with text
        const svg = `
            <svg width="${width}" height="${height}">
                <rect width="100%" height="100%" fill="${backgroundColor}"/>
                <text 
                    x="50%" 
                    y="50%" 
                    font-family="Arial, sans-serif" 
                    font-size="48" 
                    fill="${textColor}" 
                    text-anchor="middle" 
                    dominant-baseline="middle"
                >${text}</text>
            </svg>
        `;

        // Generate unique filename
        const hash = crypto.createHash('sha1')
            .update(`${text}-${width}-${height}-${new Date().getTime()}`, 'utf8')
            .digest('hex');
        
        const extension = format === 'jpeg' ? 'jpeg' : 'png';
        const imagePath = `/uploads/${userid}/${category}/${hash}.${extension}`;
        const fullPath = `${process.env.STJORNA_SERVER_STORAGE}${imagePath}`;

        // Ensure directory exists
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Generate image from SVG
        const sharpInstance = sharp(Buffer.from(svg));
        
        if (format === 'jpeg') {
            await sharpInstance.jpeg({ quality: 90 }).toFile(fullPath);
        } else {
            await sharpInstance.png().toFile(fullPath);
        }

        logger.info(`image_generator - generated placeholder image: ${imagePath}`);
        
        // Return API path
        return `/data${imagePath}`;
    } catch (error) {
        logger.error(`image_generator - error generating placeholder image: ${error.message}`);
        throw error;
    }
};
