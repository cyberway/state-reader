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
                    inherits: ['pagination'],
                    handler: this._bcMongo.getDelegations,
                    scope: this._bcMongo,
                },
                getValidators: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getValidators,
                    scope: this._bcMongo,
                },
                getLeaders: {
                    handler: this._bcMongo.getLeaders,
                    scope: this._bcMongo,
                },
                getNameBids: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getNameBids,
                    scope: this._bcMongo,
                },
                getLastClosedBid: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getLastClosedBid,
                    scope: this._bcMongo,
                },
                getReceivedGrants: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getReceivedGrants,
                    scope: this._bcMongo,
                },
            },
            serverDefaults: {
                parents: {
                    pagination: {
                        validation: {
                            properties: {
                                offset: {
                                    type: 'number',
                                    default: 0,
                                },
                                limit: {
                                    type: 'number',
                                    default: 20,
                                },
                            },
                        },
                    },
                },
            },
        });

        await super.setDefaultResponse(null);
    }
}

module.exports = Connector;
