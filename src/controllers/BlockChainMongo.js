const { MongoClient } = require('mongodb');
const core = require('gls-core-service');
const BasicController = core.controllers.Basic;

const env = require('../data/env');
const { formatAsset, extractNumber, fixTimestamp } = require('../utils');

class BlockChainMongo extends BasicController {
    async boot() {
        this._client = await this._initializeClient();
        await this._createGlsnameView();
    }

    async _initializeClient() {
        return new Promise((resolve, reject) => {
            const client = new MongoClient(env.GLS_CYBERWAY_MONGO_CONNECT);

            client.connect((err, client) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(client);
            });
        });
    }

    async _createGlsnameView() {
        const db = this._client.db('_CYBERWAY_');

        const collectionExist = (await db.listCollections().toArray()).find(
            collection => collection.name === 'glsname'
        );

        if (!collectionExist) {
            await db.createCollection('glsname', {
                viewOn: 'username',
                pipeline: [{ $match: { scope: 'gls' } }, { $project: { owner: 1, name: 1 } }],
            });
        }
    }

    async getLeaders() {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('permission');

        const query = { owner: 'gls', name: 'witn.smajor' };

        const items = await collection
            .aggregate([
                { $match: query },
                { $project: { account: '$auth.accounts.permission.actor' } },
                { $unwind: '$account' },
                {
                    $lookup: {
                        as: 'u',
                        foreignField: 'owner',
                        from: 'glsname',
                        localField: 'account',
                    },
                },
                {
                    $project: {
                        _id: false,
                        account: true,
                        glsname: { $arrayElemAt: ['$u.name', 0] },
                    },
                },
            ])
            .toArray();

        return { items };
    }

    async _getStakeStat() {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('stake_stat');

        return await collection.findOne({});
    }

    async getValidators({ offset, limit, voterId }) {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('stake_cand');

        const totalVotes = (await this._getStakeStat()).total_votes;

        const items = await collection
            .aggregate([
                { $match: { enabled: true } },
                {
                    $lookup: {
                        as: 'u',
                        foreignField: 'owner',
                        from: 'glsname',
                        localField: 'account',
                    },
                },
                {
                    $project: {
                        _id: false,
                        account: true,
                        votes: true,
                        pct: { $divide: ['$votes', totalVotes] },
                        glsname: { $arrayElemAt: ['$u.name', 0] },
                    },
                },
                {
                    $sort: {
                        token_code: 1,
                        enabled: 1,
                        votes: -1,
                        account: 1,
                    },
                },
            ])
            .skip(offset)
            .limit(limit)
            .toArray();

        if (voterId) {
            const grants = await this._getGrantsByAccount(
                items.map(({ account }) => account),
                voterId
            );

            for (const item of items) {
                const share = grants.get(item.account);

                if (share) {
                    item.grant = {
                        share,
                    };
                } else {
                    item.grant = null;
                }
            }
        }

        return {
            items,
        };
    }

    async _getGrantsByAccount(receiverIds, account) {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('stake_grant');

        const grants = await collection
            .aggregate([
                {
                    $match: {
                        recipient_name: { $in: receiverIds },
                        grantor_name: account,
                    },
                },
                {
                    $group: {
                        _id: '$recipient_name',
                        totalShare: {
                            $sum: '$share',
                        },
                    },
                },
            ])
            .toArray();

        const grantsMap = new Map();

        for (const grant of grants) {
            grantsMap.set(grant._id, grant.totalShare);
        }

        return grantsMap;
    }

    async getDelegations({ userId, offset, limit, direction }) {
        const db = this._client.db('_CYBERWAY_gls_vesting');
        const collection = db.collection('delegation');

        const directionFilter = [];

        if (direction === 'out') {
            directionFilter.push({ delegator: userId });
        }

        if (direction === 'in') {
            directionFilter.push({ delegatee: userId });
        }

        if (direction === 'all') {
            directionFilter.push({ delegator: userId }, { delegatee: userId });
        }

        const items = await collection
            .find({
                $or: directionFilter,
            })
            .project({ _id: false, id: false, _SERVICE_: false })
            .skip(offset)
            .limit(limit)
            .toArray();

        for (const item of items) {
            item.quantity = formatAsset(item.quantity);
            item.interest_rate = extractNumber(item.interest_rate);
            item.min_delegation_time = fixTimestamp(item.min_delegation_time);
        }

        return {
            items,
        };
    }

    async getNameBids({ offset, limit }) {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('namebids');

        const items = await collection
            .aggregate([
                {
                    $match: {
                        high_bid: { $gt: 0 },
                    },
                },
                {
                    $lookup: {
                        as: 'u',
                        foreignField: 'owner',
                        from: 'glsname',
                        localField: 'high_bidder',
                    },
                },
                {
                    $sort: {
                        high_bid: -1,
                        newname: 1,
                        _id: 1,
                    },
                },
                {
                    $project: {
                        _id: false,
                        newname: true,
                        high_bidder: true,
                        high_bid: true,
                        last_bid_time: true,
                        glsname: { $arrayElemAt: ['$u.name', 0] },
                    },
                },
            ])
            .skip(offset)
            .limit(limit)
            .toArray();

        return {
            items,
        };
    }

    async getLastClosedBid() {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('biosstate');

        const bids = await collection.findOne(
            {},
            {
                last_closed_bid: 1,
            }
        );

        return {
            lastClosedBid: bids,
        };
    }

    async getReceivedGrants({ account, limit, offset }) {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('stake_grant');

        const items = await collection
            .find({
                recipient_name: account,
                share: { $gt: 0 },
            })
            .sort({
                share: -1,
                _id: 1,
            })
            .skip(offset)
            .limit(limit)
            .project({
                _id: false,
                grantor_name: true,
                pct: true,
                share: true,
                break_fee: true,
                break_min_own_staked: true,
            })
            .toArray();

        return {
            items,
        };
    }
}

module.exports = BlockChainMongo;
