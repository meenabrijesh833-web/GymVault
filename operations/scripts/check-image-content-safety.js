const assert = require('node:assert/strict');
const path = require('path');
const sharp = require('sharp');

const workspaceRoot = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(workspaceRoot, '.env') });

const { adminPool, pool } = require('../../backend/config/db');
const {
    sanitizeInlineImageDataUrl,
    sanitizeInlineImageList,
} = require('../../backend/utils/inlineImageSafety');

const toDataUrl = (mimeType, buffer) => `data:${mimeType};base64,${buffer.toString('base64')}`;

const expectRejected = async (label, runner, matcher) => {
    try {
        await assert.rejects(runner, matcher);
    } catch (error) {
        throw new Error(`${label}: ${error.message}`);
    }
};

const run = async () => {
    const png = await sharp({
        create: {
            width: 32,
            height: 32,
            channels: 4,
            background: { r: 25, g: 90, b: 140, alpha: 1 },
        },
    }).png().toBuffer();
    const validPngUrl = toDataUrl('image/png', png);

    const sanitized = await sanitizeInlineImageDataUrl(validPngUrl, { field: 'fixture' });
    assert.match(sanitized, /^data:image\/webp;base64,/);
    const sanitizedBuffer = Buffer.from(sanitized.split(',')[1], 'base64');
    const sanitizedMetadata = await sharp(sanitizedBuffer).metadata();
    assert.equal(sanitizedMetadata.format, 'webp');
    assert.equal(sanitizedMetadata.pages || 1, 1);

    await expectRejected(
        'MIME mismatch',
        () => sanitizeInlineImageDataUrl(toDataUrl('image/jpeg', png), { field: 'mime_fixture' }),
        /does not match its declared image type/i
    );
    await expectRejected(
        'Malformed base64',
        () => sanitizeInlineImageDataUrl(validPngUrl.replace(';base64,', ';base64, '), { field: 'base64_fixture' }),
        /uploaded JPG, PNG, or WEBP/i
    );
    await expectRejected(
        'Decoded size limit',
        () => sanitizeInlineImageDataUrl(toDataUrl('image/png', Buffer.alloc(1025, 1)), {
            field: 'size_fixture',
            maxBytes: 1024,
        }),
        /size limit|oversized/i
    );

    const polyglotMarker = Buffer.from('<script>polyglot-marker</script>', 'utf8');
    const polyglot = Buffer.concat([png, polyglotMarker]);
    const sanitizedPolyglot = await sanitizeInlineImageDataUrl(toDataUrl('image/png', polyglot), {
        field: 'polyglot_fixture',
    });
    const sanitizedPolyglotBuffer = Buffer.from(sanitizedPolyglot.split(',')[1], 'base64');
    assert.equal(sanitizedPolyglotBuffer.includes(polyglotMarker), false);
    assert.doesNotMatch(sanitizedPolyglot, /polyglot-marker/i);

    const oversizedPixelsPng = await sharp({
        create: {
            width: 1200,
            height: 1200,
            channels: 3,
            background: { r: 240, g: 240, b: 240 },
        },
    }).png({ compressionLevel: 9 }).toBuffer();
    assert.ok(oversizedPixelsPng.length < 2 * 1024 * 1024, 'Pixel-bomb fixture should remain compressed.');
    await expectRejected(
        'Pixel bomb',
        () => sanitizeInlineImageDataUrl(toDataUrl('image/png', oversizedPixelsPng), {
            field: 'pixel_bomb_fixture',
            maxPixels: 1_000_000,
        }),
        /dimensions are too large|safely decoded/i
    );

    await expectRejected(
        'Image quantity',
        () => sanitizeInlineImageList(Array(5).fill(validPngUrl), {
            field: 'quantity_fixture',
            maxItems: 4,
        }),
        /at most 4 images/i
    );

    console.log('Inline image content safety checks passed.');
};

run()
    .catch((error) => {
        console.error(error.message || error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await Promise.allSettled([pool.end(), adminPool.end()]);
    });
