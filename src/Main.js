const core = require('gls-core-service');
const BasicMain = core.services.BasicMain;
// const MongoDB = core.services.MongoDB;
const Connector = require('./services/Connector');
const env = require('./data/env');

class Main extends BasicMain {
    constructor() {
        super(env);
        const connector = new Connector();
        this.addNested(connector);
    }

    // async boot() {
    // super.boot();
    // await new MongoDB().start(env.GLS_CYBERWAY_MONGO_CONNECT);
    // }
}

module.exports = Main;
