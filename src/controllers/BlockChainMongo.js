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

    async getValidators({ sequenceKey = null, limit = 10 }) {
        const db = this._client.db('_CYBERWAY_');
        const query = {};
        if (sequenceKey) {
            query._id = { $gt: ObjectId(sequenceKey) };
        }

        const projection = { id: false, _SERVICE_: false };

        const collection = db.collection('stake_cand');
        const validators = await collection
            .find(query)
            .project(projection)
            .sort([['priority', 1]])
            .limit(limit)
            .toArray();

        let newSequenceKey = null;

        if (validators.length === limit) {
            newSequenceKey = validators[validators.length - 1]._id;
        }

        return {
            validators,
            sequenceKey: newSequenceKey,
        };
    }
}

module.exports = BlockChainMongo;
