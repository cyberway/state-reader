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
                    inherits: ['pagination', 'userSpecific'],
                    handler: this._bcMongo.getDelegations,
                    scope: this._bcMongo,
                    validation: {
                        properties: {
                            direction: {
                                type: 'string',
                                default: 'all',
                                enum: ['in', 'out', 'all'],
                            },
                        },
                    },
                },
                getValidators: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getValidators,
                    scope: this._bcMongo,
                    validation: {
                        properties: {
                            voterId: {
                                type: ['string', 'null'],
                            },
                        },
                    },
                },
                getLeaders: {
                    handler: this._bcMongo.getLeaders,
                    scope: this._bcMongo,
                    validation: {},
                },
                getNameBids: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getNameBids,
                    scope: this._bcMongo,
                    validation: {},
                },
                getLastClosedBid: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getLastClosedBid,
                    scope: this._bcMongo,
                    validation: {},
                },
                getReceivedGrants: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getReceivedGrants,
                    scope: this._bcMongo,
                    validation: {},
                },
                getTokens: {
                    handler: this._bcMongo.getTokens,
                    scope: this._bcMongo,
                    validation: {},
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
                    userSpecific: {
                        validation: {
                            required: ['userId'],
                            properties: {
                                userId: {
                                    type: 'string',
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
