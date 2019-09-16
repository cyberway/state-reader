const core = require('gls-core-service');
const BasicConnector = core.services.Connector;
const BlockChainMongo = require('../controllers/BlockChainMongo');

class Connector extends BasicConnector {
    constructor() {
        super();

        this._bcMongo = new BlockChainMongo({ connector: this });
    }

    async start() {
        await this._bcMongo.boot();
        await super.start({
            serverRoutes: {
                getDelegations: {
                    handler: this._bcMongo.getDelegations,
                    scope: this._bcMongo,
                },
                getValidators: {
                    handler: this._bcMongo.getValidators,
                    scope: this._bcMongo,
                },
            },
        });

        await super.setDefaultResponse(null);
    }
}

module.exports = Connector;
