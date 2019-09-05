const core = require('gls-core-service');
const BasicConnector = core.services.Connector;
const BlockChainMongo = require('../controllers/BlockChainMongo');

class Connector extends BasicConnector {
    constructor({ mongodb }) {
        super();

        this._bcMongo = new BlockChainMongo({ connector: this, mongodb });
    }

    async start() {
        await super.start({
            serverRoutes: {
                getDelegations: {
                    handler: this._bcMongo.getDelegations,
                    scope: this._bcMongo,
                },
            },
        });

        await super.setDefaultResponse(null);
    }
}

module.exports = Connector;
