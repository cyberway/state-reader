const core = require('cyberway-core-service');
const env = process.env;

module.exports = {
    ...core.data.env,
    GLS_CYBERWAY_MONGO_CONNECT: env.GLS_CYBERWAY_MONGO_CONNECT,
};
