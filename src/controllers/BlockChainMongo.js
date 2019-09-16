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
    async getDelegations() {}

    async getValidators({ sequenceKey = null, limit = 10 }) {
        const query = {};
        if (sequenceKey) {
            query._id = { $gt: ObjectId(sequenceKey) };
        }

        const projection = { id: false, _SERVICE_: false };

        const collection = this._client.db('_CYBERWAY_').collection('stake_cand');
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
