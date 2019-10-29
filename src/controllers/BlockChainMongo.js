const { MongoClient } = require('mongodb');
const core = require('gls-core-service');
const BasicController = core.controllers.Basic;

const env = require('../data/env');
const {
    formatAsset,
    extractNumber,
    fixTimestamp,
    fixKnownMongoObject,
    isPlainObject,
    snakeToCamel,
    renameFields,
} = require('../utils');

const MONGO_DB_PREFIX = '_CYBERWAY_'; // node can be configured to use other prefix (several nodes with 1 mongodb)

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
        const db = this._client.db(MONGO_DB_PREFIX);

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

    _collection({ dbName, name }) {
        const db = this._client.db(MONGO_DB_PREFIX + (dbName || ''));
        return db.collection(name);
    }

    // "2019-08-15T18:16:30.000"
    _isCyberwayDate(s) {
        return Boolean(
            s && typeof s === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}$/.test(s)
        );
    }

    _fixMongoObject(o) {
        let result = o;

        if (Array.isArray(o)) {
            result = o.map(x => this._fixMongoObject(x));
        } else if (isPlainObject(o)) {
            const [fixed, value] = fixKnownMongoObject(o);
            if (fixed) {
                result = value;
            } else {
                result = {};
                for (const [key, val] of Object.entries(o)) {
                    result[snakeToCamel(key)] = this._fixMongoObject(val);
                }
            }
        } else if (this._isCyberwayDate(o)) {
            return fixTimestamp(o);
        }

        return result;
    }

    _fixMongoResult(data, rename) {
        if (!data) {
            return data;
        }

        const fixed = this._fixMongoObject(data);
        const array = [].concat(fixed);
        const renamed = rename ? array.map(item => renameFields(item, rename)) : array;
        return Array.isArray(data) ? renamed : renamed[0];
    }

    _makeProjection(fields, value = true) {
        // return Object.fromEntries((fields || []).map(field => [field, true]));
        const result = {};
        for (const field of fields || []) {
            result[field] = value;
        }
        return result;
    }

    async getLeaders() {
        const collection = this._collection({ name: 'permission' });

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

    // fields: [id, token_code, total_staked, total_votes, last_reward, enabled]
    async getStakeStat({ fields }) {
        const collection = this._collection({ name: 'stake_stat' });

        const state = await collection.findOne(
            {},
            {
                projection: {
                    _id: false,
                    token_code: true,
                    ...this._makeProjection(fields),
                },
            }
        );

        return this._fixMongoResult(state);
    }

    async getValidators({ offset, limit, voterId }) {
        const collection = this._collection({ name: 'stake_cand' });

        const { totalVotes } = await this.getStakeStat({ fields: ['total_votes'] });

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
        const collection = this._collection({ name: 'stake_grant' });

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
        const collection = this._collection({ dbName: 'gls_vesting', name: 'delegation' });

        const directionFilter = [];

        if (direction === 'out' || direction === 'all') {
            directionFilter.push({ delegator: userId });
        }

        if (direction === 'in' || direction === 'all') {
            directionFilter.push({ delegatee: userId });
        }

        const results = await collection
            .find(
                {
                    $or: directionFilter,
                },
                {
                    projection: {
                        _id: false,
                        delegator: true,
                        delegatee: true,
                        quantity: true,
                        interest_rate: true,
                        min_delegation_time: true,
                    },
                }
            )
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

    // TODO: it's faster to have cached usernames on block-service side instead of lookup
    async getNameBids({ offset, limit, domain }) {
        const src = domain ? { dbName: 'cyber_domain', name: 'domainbid' } : { name: 'namebids' };
        const collection = this._collection(src);

        const nameField = domain ? { name: 1 } : { newname: 1 }; // Note: used both in sort and project
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
                        ...nameField,
                        _id: 1,
                    },
                },
                {
                    $project: {
                        _id: false,
                        ...nameField,
                        high_bidder: true,
                        high_bid: true,
                        last_bid_time: true,
                        glsName: { $arrayElemAt: ['$u.name', 0] },
                    },
                },
            ])
            .skip(offset)
            .limit(limit)
            .toArray();

        return { items: this._fixMongoResult(results, { newname: 'name' }) };
    }

    async getLastClosedBid({ domain }) {
        const src = domain ? { dbName: 'cyber_domain', name: 'dbidstate' } : { name: 'biosstate' };
        const collection = this._collection(src);

        const lastField = domain ? { last_win: true } : { last_close_bid: true };
        const bid = await collection.findOne({}, { projection: { _id: false, ...lastField } });

        const renames = { lastCloseBid: 'lastClosedBid', lastWin: 'lastClosedBid' };
        return this._fixMongoResult(bid, renames);
    }

    async getReceivedGrants({ account, limit, offset }) {
        const collection = this._collection({ name: 'stake_grant' });

        const results = await collection
            .find(
                {
                    recipient_name: account,
                    share: { $gt: 0 },
                },
                {
                    projection: {
                        _id: false,
                        grantor_name: true,
                        pct: true,
                        share: true,
                        break_fee: true,
                        break_min_own_staked: true,
                    },
                }
            )
            .sort({
                share: -1,
                _id: 1,
            })
            .skip(offset)
            .limit(limit)
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
        const collection = this._collection({ dbName: 'cyber_token', name: 'stat' });

        const result = await collection
            .find(
                {},
                {
                    projection: {
                        _id: false,
                        issuer: true,
                        supply: true,
                        max_supply: true,
                        '_SERVICE_.scope': true,
                    },
                }
            )
            .toArray();

        return {
            items: this._fixMongoResult(result).map(x => ({
                ...x,
                symbol: x._SERVICE_.scope,
                _SERVICE_: undefined,
            })),
        };
    }

    async getBalances({ accounts }) {
        const collection = this._collection({ dbName: 'cyber_token', name: 'accounts' });
        const result = await collection
            .find(
                { '_SERVICE_.scope': { $in: accounts } },
                {
                    projection: {
                        _id: false,
                        balance: true,
                        payments: true,
                        '_SERVICE_.scope': true,
                    },
                }
            )
            .toArray();

        const items = result.map(item => ({
            account: item._SERVICE_.scope,
            symbol: item.balance._sym,
            balance: formatAsset(item.balance),
            payments: formatAsset(item.payments),
        }));

        return { items };
    }

    async getTopBalances({ token, offset, limit }) {
        const collection = this._collection({ dbName: 'cyber_token', name: 'accounts' });
        const result = await collection
            .find(
                { 'balance._sym': token },
                {
                    projection: {
                        _id: false,
                        balance: true,
                        '_SERVICE_.scope': true,
                    },
                }
            )
            .sort({ 'balance._amount': -1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        const items = this._fixMongoResult(result).map(x => ({
            ...x,
            account: x._SERVICE_.scope,
            _SERVICE_: undefined,
        }));
        return { items };
    }

    async getUsernames({ accounts, scope }) {
        const collection = this._collection({ name: 'username' });
        const items = await collection
            .find(
                { scope: scope === undefined ? 'gls' : scope, owner: { $in: accounts } },
                { projection: { _id: false, owner: true, name: true } }
            )
            .toArray();

        return { items };
    }

    // fields: [account, proxy_level, fee, min_own_staked, balance, proxied, own_share, shares_sum, provided, received, last_proxied_update]
    async getStakeAgents({ accounts, fields }) {
        const collection = this._collection({ name: 'stake_agent' });
        const agents = await collection
            .find(
                { token_code: 'CYBER', account: { $in: accounts } },
                { projection: { _id: false, account: true, ...this._makeProjection(fields) } }
            )
            .toArray();

        return { items: this._fixMongoResult(agents) };
    }

    // Note: `fields` argument is somewhat tricky when combined with renameFields and toCamel:
    // user sets fields in db non-renamed format ("break_fee", "recipient_name"),
    // but gets result with renamed fields ("breakFee", "recipient").
    // TODO: resolve
    // fields: [token_code, grantor_name, recipient_name, pct, share, break_fee, break_min_own_staked]
    async getStakeGrants({ grantor, fields }) {
        const collection = this._collection({ name: 'stake_grant' });
        const grants = await collection
            .find(
                { token_code: 'CYBER', grantor_name: grantor },
                {
                    projection: {
                        _id: false,
                        recipient_name: true,
                        ...this._makeProjection(fields),
                    },
                }
            )
            .toArray();

        const renames = { grantorName: 'grantor', recipientName: 'recipient', pct: 'percent' };
        return { items: this._fixMongoResult(grants, renames) };
    }

    // token_code, account, latest_pick, votes, priority, signing_key, enabled
    async getStakeCandidates({ filter, offset, limit }) {
        const collection = this._collection({ name: 'stake_cand' });
        const fields = 'account,latest_pick,votes,signing_key,enabled'.split(',');
        const candidates = await collection
            .find(
                { token_code: 'CYBER', ...(filter || {}) },
                { projection: { _id: false, ...this._makeProjection(fields) } }
            )
            .sort({ votes: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        return { items: this._fixMongoResult(candidates) };
    }

    async getProposals({ filter, offset, limit }) {
        const collection = this._collection({ dbName: 'cyber_msig', name: 'proposal' });
        const fixedFilter = renameFields(filter || {}, { proposer: '_SERVICE_.scope' });
        const proposals = await collection
            .find(fixedFilter, {
                projection: {
                    _id: false,
                    proposal_name: true,
                    packed_transaction: true,
                    '_SERVICE_.scope': true,
                    '_SERVICE_.rev': true,
                },
            })
            .sort({ '_SERVICE_.rev': -1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        return {
            items: this._fixMongoResult(proposals).map(x => ({
                ...x,
                proposer: x._SERVICE_.scope,
                rev: x._SERVICE_.rev,
                _SERVICE_: undefined,
            })),
        };
    }

    // TODO: apply invalidations
    async getProposalApprovals({ proposer, proposal }) {
        const collection = this._collection({ dbName: 'cyber_msig', name: 'approvals2' });
        const filter = proposal ? { proposal_name: { $in: [].concat(proposal) } } : {};
        const approvals = await collection
            .find(
                { '_SERVICE_.scope': proposer, ...filter },
                {
                    projection: {
                        _id: false,
                        proposal_name: true,
                        requested_approvals: true,
                        provided_approvals: true,
                    },
                }
            )
            .sort({ '_SERVICE_.rev': -1 })
            .toArray();

        // TODO: result can be simplified by removing zero time and returning level as "actor@permission"
        const renames = { requestedApprovals: 'requested', providedApprovals: 'provided' };
        return { items: this._fixMongoResult(approvals, renames) };
    }
}

module.exports = BlockChainMongo;
