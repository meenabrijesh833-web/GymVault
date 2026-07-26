const sharp = require('sharp');
const { ValidationError } = require('./fieldValidation');
const { recordSecurityEvent } = require('./runtimeTelemetry');

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_PIXELS = 12_000_000;
const DEFAULT_MAX_DIMENSION = 1600;
const SUPPORTED_MIME_FORMATS = new Map([
    ['image/jpeg', 'jpeg'],
    ['image/jpg', 'jpeg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
]);
const STRICT_DATA_URL = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const rejectInlineImage = (req, field, reason, message) => {
    void recordSecurityEvent(req, {
        eventType: 'UPLOAD_REJECTED',
        message: 'Inline image content was rejected.',
        statusCode: 400,
        metadata: { field, reason },
    });
    throw new ValidationError(message || `${field} must be a valid JPG, PNG, or WEBP image.`);
};

const decodeStrictBase64 = (encoded, { req, field, maxBytes }) => {
    if (!encoded || encoded.length % 4 !== 0) {
        rejectInlineImage(req, field, 'malformed_base64', `${field} contains malformed base64 image data.`);
    }

    const maxEncodedLength = Math.ceil(maxBytes / 3) * 4;
    if (encoded.length > maxEncodedLength) {
        rejectInlineImage(req, field, 'encoded_size_limit', `${field} exceeds the image size limit.`);
    }

    const buffer = Buffer.from(encoded, 'base64');
    if (!buffer.length || buffer.length > maxBytes || buffer.toString('base64') !== encoded) {
        rejectInlineImage(req, field, 'decoded_size_or_encoding', `${field} contains invalid or oversized image data.`);
    }
    return buffer;
};

const encodeSafeWebp = async (buffer, { maxBytes, maxDimension, maxPixels }) => {
    const dimensions = Array.from(new Set([
        maxDimension,
        Math.min(maxDimension, 1200),
        Math.min(maxDimension, 900),
    ])).filter((value) => value > 0);

    for (const dimension of dimensions) {
        for (const quality of [85, 70, 55]) {
            const output = await sharp(buffer, {
                animated: false,
                failOn: 'warning',
                limitInputPixels: maxPixels,
            })
                .rotate()
                .resize({
                    width: dimension,
                    height: dimension,
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .webp({ quality, effort: 4 })
                .toBuffer();

            if (output.length <= maxBytes) {
                return output;
            }
        }
    }

    return null;
};

const sanitizeInlineImageDataUrl = async (value, {
    req,
    field = 'image',
    maxBytes = DEFAULT_MAX_BYTES,
    maxPixels = DEFAULT_MAX_PIXELS,
    maxDimension = DEFAULT_MAX_DIMENSION,
    allowEmpty = false,
} = {}) => {
    const raw = String(value || '').trim();
    if (!raw) {
        if (allowEmpty) return '';
        throw new ValidationError(`${field} is required.`);
    }

    const match = STRICT_DATA_URL.exec(raw);
    if (!match) {
        rejectInlineImage(req, field, 'unsupported_data_url', `${field} must be an uploaded JPG, PNG, or WEBP image.`);
    }

    const declaredFormat = SUPPORTED_MIME_FORMATS.get(match[1].toLowerCase());
    const buffer = decodeStrictBase64(match[2], { req, field, maxBytes });

    try {
        const metadata = await sharp(buffer, {
            animated: true,
            failOn: 'warning',
            limitInputPixels: maxPixels,
        }).metadata();
        const width = Number(metadata.width || 0);
        const height = Number(metadata.height || 0);
        const pages = Number(metadata.pages || 1);

        if (!width || !height || width * height > maxPixels) {
            rejectInlineImage(req, field, 'pixel_limit', `${field} dimensions are too large.`);
        }
        if (pages !== 1) {
            rejectInlineImage(req, field, 'animated_image', `${field} must be a single-frame image.`);
        }
        if (String(metadata.format || '').toLowerCase() !== declaredFormat) {
            rejectInlineImage(req, field, 'mime_mismatch', `${field} content does not match its declared image type.`);
        }

        const output = await encodeSafeWebp(buffer, { maxBytes, maxDimension, maxPixels });
        if (!output) {
            rejectInlineImage(req, field, 'sanitized_size_limit', `${field} cannot be safely compressed within the image size limit.`);
        }
        return `data:image/webp;base64,${output.toString('base64')}`;
    } catch (error) {
        if (error instanceof ValidationError) throw error;
        rejectInlineImage(req, field, 'decode_failed', `${field} could not be safely decoded.`);
    }
};

const sanitizeInlineImageList = async (value, {
    req,
    field = 'images',
    required = false,
    maxItems = 4,
    ...imageOptions
} = {}) => {
    if (value === undefined || value === null || value === '') {
        if (required) throw new ValidationError(`${field} is required.`);
        return [];
    }
    if (!Array.isArray(value)) {
        throw new ValidationError(`${field} must be an array.`);
    }
    if (value.length > maxItems) {
        throw new ValidationError(`${field} can include at most ${maxItems} images.`);
    }
    if (required && value.length === 0) {
        throw new ValidationError(`At least one ${field} image is required.`);
    }

    const sanitized = [];
    for (let index = 0; index < value.length; index += 1) {
        sanitized.push(await sanitizeInlineImageDataUrl(value[index], {
            req,
            field: `${field}[${index}]`,
            ...imageOptions,
        }));
    }
    return sanitized;
};

module.exports = {
    DEFAULT_MAX_BYTES,
    DEFAULT_MAX_PIXELS,
    DEFAULT_MAX_DIMENSION,
    sanitizeInlineImageDataUrl,
    sanitizeInlineImageList,
};
