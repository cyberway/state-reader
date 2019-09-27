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
                        glsName: { $arrayElemAt: ['$u.name', 0] },
                    },
                },
            ])
            .toArray();

        return { items };
    }

    async _getStakeStat(fields) {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('stake_stat');

        return await collection.findOne(
            {},
            {
                _id: false,
                id: true,
                _SERVICE_: false,
                ...fields,
            }
        );
    }

    async getValidators({ offset, limit, voterId }) {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('stake_cand');

        const totalVotes = (await this._getStakeStat({ total_votes: true })).total_votes;

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
                        percent: { $divide: ['$votes', totalVotes] },
                        glsName: { $arrayElemAt: ['$u.name', 0] },
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

        const results = await collection
            .find({
                $or: directionFilter,
            })
            .project({
                _id: false,
                delegator: true,
                delegatee: true,
                quantity: true,
                interest_rate: true,
                min_delegation_time: true,
            })
            .skip(offset)
            .limit(limit)
            .toArray();

        const items = results.map(item => ({
            delegator: item.delegator,
            delegatee: item.delegatee,
            quantity: formatAsset(item.quantity),
            interestRate: extractNumber(item.interest_rate),
            minDelegationTime: fixTimestamp(item.min_delegation_time),
        }));

        return {
            items,
        };
    }

    async getNameBids({ offset, limit }) {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('namebids');

        const results = await collection
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

        const items = results.map(item => ({
            newName: item.newname,
            highBidder: item.high_bidder,
            highBid: item.high_bid,
            lastBidTime: item.last_bid_time,
            glsName: item.glsname,
        }));

        return {
            items,
        };
    }

    async getLastClosedBid() {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('biosstate');

        const bid = await collection.findOne(
            {},
            {
                last_closed_bid: true,
            }
        );

        return {
            lastClosedBid: bid.last_closed_bid,
        };
    }

    async getReceivedGrants({ account, limit, offset }) {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('stake_grant');

        const results = await collection
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

        const items = results.map(item => ({
            grantor: item.grantor_name,
            percent: item.pct,
            share: item.share,
            breakFee: item.break_fee,
            breakMinOwnStaked: item.break_min_own_staked,
        }));

        return {
            items,
        };
    }

    async getTokens() {
        const db = this._client.db('_CYBERWAY_cyber_token');
        const collection = db.collection('stat');

        const results = await collection
            .find({})
            .project({
                _id: false,
                issuer: true,
                supply: true,
                max_supply: true,
                '_SERVICE_.scope': true,
            })
            .toArray();

        const items = results.map(item => ({
            symbol: item._SERVICE_.scope,
            issuer: item.issuer,
            supply: formatAsset(item.supply),
            maxSupply: formatAsset(item.max_supply),
        }));

        return {
            items,
        };
    }
}

module.exports = BlockChainMongo;
