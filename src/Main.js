const core = require('gls-core-service');
const BasicMain = core.services.BasicMain;
const Connector = require('./services/Connector');
const env = require('./data/env');

class Main extends BasicMain {
    constructor() {
        super(env);
        const connector = new Connector();
        this.addNested(connector);
    }
}

module.exports = Main;
