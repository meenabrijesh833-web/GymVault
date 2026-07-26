const express = require('express');
const { routeRequestSchema } = require('./strictRequest');

const ROUTE_METHODS = ['delete', 'get', 'patch', 'post', 'put'];

const flattenHandlers = (handlers) => handlers.flat(Infinity).filter(Boolean);

const createValidatedRouter = (options) => {
    const router = express.Router(options);

    for (const method of ROUTE_METHODS) {
        const register = router[method].bind(router);
        router[method] = (routePath, ...registeredHandlers) => {
            const handlers = flattenHandlers(registeredHandlers);
            if (handlers.length === 0) {
                return register(routePath);
            }

            const schemaMiddleware = routeRequestSchema(routePath, method, handlers);
            return register(
                routePath,
                schemaMiddleware,
                ...handlers
            );
        };
    }

    router.usesValidatedRequests = true;
    return router;
};

module.exports = { createValidatedRouter };
