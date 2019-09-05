const core = require('gls-core-service');
const BasicController = core.controllers.Basic;

class BlockChainMongo extends BasicController {
    constructor({ connector, mongodb }) {
        super({ connector });
        this._connection = mongodb.connection;
    }
    getDelegations() {}
}

module.exports = BlockChainMongo;
