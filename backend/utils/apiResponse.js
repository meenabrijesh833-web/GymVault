function ok(res, data = null, legacy = {}) {
    return res.json({
        success: true,
        data,
        error: null,
        ...legacy,
    });
}

function fail(res, statusCode, code, message, details = null, legacy = {}) {
    return res.status(statusCode).json({
        success: false,
        data: null,
        error: message,
        code,
        details,
        ...legacy,
    });
}

module.exports = { ok, fail };
