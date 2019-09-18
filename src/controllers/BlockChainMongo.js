const core = require('gls-core-service');
const BasicController = core.controllers.Basic;
const env = require('../data/env');
const { MongoClient, ObjectId } = require('mongodb');

class BlockChainMongo extends BasicController {
    async boot() {
        return new Promise((resolve, reject) => {
            const client = new MongoClient(env.GLS_CYBERWAY_MONGO_CONNECT);
            client.connect((err, client) => {
                if (err) {
                    reject(err);
                }
                this._client = client;
                resolve();
            });
        });
    }

    async getLeaders() {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('permission');

        const query = { owner: 'gls', name: 'witn.smajor' };

        const leaders = await collection
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
                { $project: { account: 1, glsname: '$u.name' } },
            ])
            .toArray();

        return { leaders };
    }

    async _getStakeStat() {
        const db = this._client.db('_CYBERWAY_');
        const query = {};

        const collection = db.collection('stake_stat');
        const stakeStat = await collection.find(query).toArray();

        return stakeStat[0];
    }

    async getValidators({ sequenceKey = null, limit = 10 }) {
        const db = this._client.db('_CYBERWAY_');
        const collection = db.collection('stake_cand');

        const query = { enabled: true };

        if (sequenceKey) {
            query._id = { $gt: ObjectId(sequenceKey) };
        }

        const totalVotes = (await this._getStakeStat()).total_votes;

        const validators = await collection
            .aggregate([
                { $match: query },
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
                        account: 1,
                        glsname: { $arrayElemAt: ['$u.name', 0] },
                        votes: 1,
                        _id: 1,
                        pct: { $divide: ['$votes', totalVotes] },
                    },
                },
                { $sort: { token_code: 1, enabled: 1, votes: -1, account: 1 } },
            ])
            .limit(limit)
            .toArray();

        let newSequenceKey = null;
        if (validators.length === limit) {
            newSequenceKey = validators[validators.length - 1]._id;
        }

        return {
            validators: validators.map(validator => {
                delete validator._id;
                return validator;
            }),
            sequenceKey: newSequenceKey,
        };
    }

    async getDelegations({ sequenceKey = null, limit = 10 }) {
        const db = this._client.db('_CYBERWAY_gls_vesting');
        const query = {};
        if (sequenceKey) {
            query._id = { $gt: ObjectId(sequenceKey) };
        }

        const projection = { id: false, _SERVICE_: false };

        const collection = db.collection('delegation');
        const delegations = await collection
            .find(query)
            .project(projection)
            .limit(limit)
            .toArray();

        let newSequenceKey = null;

        if (delegations.length === limit) {
            newSequenceKey = delegations[delegations.length - 1]._id;
        }

        return {
            delegations,
            sequenceKey: newSequenceKey,
        };
    }

    async getNameBids({ sequenceKey = null, limit = 10 }) {
        const db = this._client.db('_CYBERWAY_');
        const query = { high_bid: { $gt: 0 } };
        if (sequenceKey) {
            query._id = { $gt: ObjectId(sequenceKey) };
        }

        const projection = {
            newname: 1,
            high_bidder: 1,
            high_bid: 1,
            last_bid_time: 1,
            glsname: { $arrayElemAt: ['$u.name', 0] },
        };

        const collection = db.collection('namebids');

        const namebids = await collection
            .aggregate([
                { $match: query },
                {
                    $lookup: {
                        as: 'u',
                        foreignField: 'owner',
                        from: 'glsname',
                        localField: 'high_bidder',
                    },
                },
                { $sort: { high_bid: -1, newname: 1 } },
                {
                    $project: projection,
                },
            ])
            .limit(limit)
            .toArray();

        let newSequenceKey = null;

        if (namebids.length === limit) {
            newSequenceKey = namebids[namebids.length - 1]._id;
        }

        return {
            namebids,
            sequenceKey: newSequenceKey,
        };
    }
}

module.exports = BlockChainMongo;
