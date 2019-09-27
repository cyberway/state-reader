const core = require('gls-core-service');
const BigNum = core.types.BigNum;

const { Logger } = core.utils;

function formatAsset(value) {
    if (!value) {
        return value;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (!value._amount || !value._decs || !value._sym) {
        Logger.error('Invalid asset format:', value);
        throw new Error('Invalid asset format');
    }

    const bigNum = new BigNum(value._amount);

    const decs = Number(value._decs.toString());

    return `${bigNum.shiftedBy(-decs).toFixed(decs)} ${value._sym}`;
}

function extractNumber(value) {
    if (!value) {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'string') {
        return value;
    }

    if (value._bsontype === 'Decimal128') {
        return value.toString();
    }

    Logger.error('Invalid number format:', value);
    throw new Error('Invalid number format');
}

function fixTimestamp(timestamp) {
    if (!timestamp) {
        return timestamp;
    }

    if (!timestamp.endsWith('Z')) {
        return `${timestamp}Z`;
    }

    return timestamp;
}

module.exports = {
    formatAsset,
    extractNumber,
    fixTimestamp,
};
