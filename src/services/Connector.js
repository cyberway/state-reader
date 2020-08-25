const VERSION = require('../../package.json').version;
const core = require('cyberway-core-service');
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
                    inherits: ['auctionSelect', 'pagination'],
                    handler: this._bcMongo.getNameBids,
                    scope: this._bcMongo,
                    validation: {},
                },
                getLastClosedBid: {
                    inherits: ['auctionSelect'],
                    handler: this._bcMongo.getLastClosedBid,
                    scope: this._bcMongo,
                    validation: {},
                },
                getReceivedGrants: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getReceivedGrants,
                    scope: this._bcMongo,
                    validation: {
                        required: ['account'],
                        properties: {
                            account: { type: 'string' },
                        },
                    },
                },
                getTokens: {
                    handler: this._bcMongo.getTokens,
                    scope: this._bcMongo,
                    validation: {},
                },
                getBalances: {
                    handler: this._bcMongo.getBalances,
                    scope: this._bcMongo,
                    validation: {
                        required: ['accounts'],
                        properties: {
                            accounts: {
                                type: 'array',
                                items: { type: 'string' },
                                minItems: 1,
                                maxItems: 100,
                            },
                        },
                    },
                },
                getTopBalances: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getTopBalances,
                    scope: this._bcMongo,
                    validation: {
                        required: ['token'],
                        properties: {
                            token: { type: 'string' },
                        },
                    },
                },
                getAccountBalances: {
                    handler: this._bcMongo.getAccountBalances,
                    scope: this._bcMongo,
                    validation: {
                        required: ['account'],
                        properties: {
                            account: { type: 'string' },
                            contracts: {
                                type: 'array',
                                items: { type: 'string' },
                                minItems: 1,
                                maxItems: 10,
                            },
                            withPayments: { type: 'boolean' },
                            withSafe: { type: 'boolean' },
                        },
                    },
                },
                getAccountsByAuth: {
                    handler: this._bcMongo.getAccountsByAuth,
                    scope: this._bcMongo,
                    validation: {
                        properties: {
                            key: { type: 'string', minLength: 53, maxLength: 53 },
                            account: { type: 'string', minLength: 1, maxLength: 13 },
                        },
                        oneOf: [{ required: ['key'] }, { required: ['account'] }],
                    },
                },
                getUsernames: {
                    handler: this._bcMongo.getUsernames,
                    scope: this._bcMongo,
                    validation: {
                        properties: {
                            scope: { type: 'string', minLength: 1, maxLength: 12 },
                            accounts: {
                                type: 'array',
                                items: { type: 'string' },
                                minItems: 1,
                                maxItems: 100,
                            },
                            names: {
                                type: 'array',
                                items: { type: 'string' },
                                minItems: 1,
                                maxItems: 100,
                            },
                        },
                        oneOf: [{ required: ['accounts'] }, { required: ['names'] }],
                    },
                },
                getDomains: {
                    handler: this._bcMongo.getDomains,
                    scope: this._bcMongo,
                    validation: {
                        properties: {
                            accounts: {
                                type: 'array',
                                items: { type: 'string' },
                                minItems: 1,
                                maxItems: 100,
                            },
                            names: {
                                type: 'array',
                                items: { type: 'string' },
                                minItems: 1,
                                maxItems: 100,
                            },
                        },
                        oneOf: [{ required: ['accounts'] }, { required: ['names'] }],
                    },
                },
                getStakeStat: {
                    inherits: ['fieldsSelect'],
                    handler: this._bcMongo.getStakeStat,
                    scope: this._bcMongo,
                    validation: {},
                },
                getStakeAgents: {
                    inherits: ['fieldsSelect'],
                    handler: this._bcMongo.getStakeAgents,
                    scope: this._bcMongo,
                    validation: {
                        required: ['accounts'],
                        properties: {
                            accounts: {
                                type: 'array',
                                items: { type: 'string' },
                                minItems: 1,
                                maxItems: 100,
                            },
                        },
                    },
                },
                getStakeGrants: {
                    inherits: ['fieldsSelect'],
                    handler: this._bcMongo.getStakeGrants,
                    scope: this._bcMongo,
                    validation: {
                        required: ['grantor'],
                        properties: {
                            grantor: { type: 'string' },
                        },
                    },
                },
                getStakeCandidates: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getStakeCandidates,
                    scope: this._bcMongo,
                    validation: {
                        properties: {
                            filter: { type: 'object', default: {} },
                        },
                    },
                },
                getProposals: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getProposals,
                    scope: this._bcMongo,
                    validation: {
                        properties: {
                            filter: { type: 'object', default: {} },
                        },
                    },
                },
                getProposalApprovals: {
                    handler: this._bcMongo.getProposalApprovals,
                    scope: this._bcMongo,
                    validation: {
                        required: ['proposer'],
                        properties: {
                            proposer: { type: 'string' },
                            proposal: {
                                type: ['string', 'array'],
                                items: { type: 'string' },
                                minItems: 1,
                                uniqueItems: true,
                            },
                        },
                    },
                },
                getProposalWaits: {
                    handler: this._bcMongo.getProposalWaits,
                    scope: this._bcMongo,
                    validation: {
                        required: ['proposer'],
                        properties: {
                            proposer: { type: 'string' },
                            proposal: {
                                type: ['string', 'array'],
                                items: { type: 'string' },
                                minItems: 1,
                                uniqueItems: true,
                            },
                        },
                    },
                },
                getPermissions: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getPermissions,
                    scope: this._bcMongo,
                    validation: {
                        required: ['owner'],
                        properties: {
                            owner: { type: 'string' },
                            name: { type: 'string', minLength: 1, maxLength: 13 },
                        },
                    },
                },
                getPermissionLinks: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getPermissionLinks,
                    scope: this._bcMongo,
                    validation: {
                        required: ['account'],
                        properties: {
                            account: { type: 'string' },
                            code: { type: 'string', minLength: 1, maxLength: 12 },
                        },
                    },
                },
                getItems: {
                    inherits: ['pagination'],
                    handler: this._bcMongo.getItems,
                    scope: this._bcMongo,
                    validation: {
                        required: ['contract', 'name'],
                        properties: {
                            contract: { type: 'string' },
                            name: { type: 'string' },
                            query: {
                                type: 'object',
                                default: {},
                            },
                            projection: {
                                type: 'object',
                                default: {},
                            },
                        },
                    },
                },
                getResState: {
                    handler: this._bcMongo.getResState,
                    scope: this._bcMongo,
                    validation: {},
                },
                getResConfig: {
                    handler: this._bcMongo.getResConfig,
                    scope: this._bcMongo,
                    validation: {},
                },
                getVersion: {
                    handler: () => ({ version: VERSION }),
                    validation: {},
                },
            },
            serverDefaults: {
                parents: {
                    pagination: {
                        validation: {
                            properties: {
                                offset: { type: 'number', default: 0 },
                                limit: { type: 'number', default: 20 },
                            },
                        },
                    },
                    userSpecific: {
                        validation: {
                            required: ['userId'],
                            properties: {
                                userId: { type: 'string' },
                            },
                        },
                    },
                    auctionSelect: {
                        validation: {
                            properties: {
                                domain: { type: 'boolean' },
                            },
                        },
                    },
                    fieldsSelect: {
                        validation: {
                            properties: {
                                fields: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    uniqueItems: true,
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
