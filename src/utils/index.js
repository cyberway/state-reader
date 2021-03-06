const { Decimal128 } = require('mongodb');
const core = require('cyberway-core-service');
const BigNum = core.types.BigNum;

const { Logger } = core.utils;

function formatAsset(value, silent = false) {
    if (!value) {
        return value;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (value._amount == null || value._decs == null || !value._sym) {
        Logger.warn('Invalid asset format:', value);
        if (!silent) throw new Error('Invalid asset format');
        return;
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

// convert to number if fits without rounding
function numberIfFits(num) {
    return Number(num).toString() === num.toString() ? Number(num) : num;
}

function fixKnownMongoObject(o) {
    const { $numberDecimal: num, _amount, _decs, _sym, _bsontype } = o;
    if (num !== undefined) {
        return [true, numberIfFits($numberDecimal)];
    }

    if (_amount !== undefined && _decs !== undefined && typeof _sym == 'string') {
        return [true, formatAsset(o)];
    }

    switch (_bsontype) {
        case 'Decimal128':
            return [true, numberIfFits(o.toString())];
        case 'ObjectID':
            return [true, o.toString()];
        default:
            break;
    }

    return [false];
}

function isPlainObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
}

// convert snake_case string to camelCase preserving leading `_`.
// returns source string unchanged if `__` or trailing `_` found.
function snakeToCamel(snake) {
    const parts = snake.split('_');
    let prefix = '';

    if (parts[0] === '') {
        prefix = '_';
        parts.shift();
    }

    if (parts.length < 1 || parts.indexOf('') > 0) {
        if (snake !== '_SERVICE_') {
            Logger.warn(`snakeToCamel: unsupported key "${snake}"`);
        }
        return snake;
    }

    prefix += parts.shift();
    return prefix + parts.map(x => x[0].toUpperCase() + x.substr(1)).join('');
}

function renameFields(obj, fields) {
    for (const [old, name] of Object.entries(fields)) {
        if (obj[old] !== undefined) {
            obj[name] = obj[old];
            delete obj[old];
        }
    }
    return obj;
}

function contractToDbName(name) {
    return name.replace(/\./g, '_');
}

function normalizeQuery(query) {
    const normalizedQuery = {};
    for (const [field, value] of Object.entries(query)) {
        if (typeof value === 'string') {
            if (value.startsWith('NumberDecimal')) {
                normalizedQuery[field] = Decimal128.fromString(value.replace(/\D/g, ''));
            } else if (value.indexOf('$in') !== -1) {
                const rawValues = value
                    .replace(' ', '')
                    .substring(value.indexOf('['), value.indexOf(']') - 1)
                    .split(',');

                const resArray = [];

                for (const el of rawValues) {
                    resArray.push(
                        value.indexOf('NumberDecimal') !== -1
                            ? Decimal128.fromString(el.replace(/\D/g, ''))
                            : el.replace(/\W/g, '')
                    );
                }

                normalizedQuery[field] = { $in: resArray };
            } else {
                normalizedQuery[field] = value;
            }
        } else {
            normalizedQuery[field] = value;
        }
    }

    return normalizedQuery;
}

module.exports = {
    formatAsset,
    extractNumber,
    fixTimestamp,
    fixKnownMongoObject,
    isPlainObject,
    snakeToCamel,
    renameFields,
    contractToDbName,
    normalizeQuery,
};
