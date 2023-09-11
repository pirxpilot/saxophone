const test = require('node:test');
const assert = require('node:assert/strict');

const Saxophone = require('../../lib');

test('should parse tag attributes', () => {
    assert.deepEqual(
        Saxophone.parseAttrs(' first="one" second="two"  third="three " '),
        {
            first: 'one',
            second: 'two',
            third: 'three '
        }
    );
});

test('should parse attributes values containing ">"', () => {
    assert.deepEqual(
        Saxophone.parseAttrs(' assert="5 > 1" '),
        {
            assert: '5 > 1',
        }
    );
});

test('should not parse attributes without a value', () => {
    assert.throws(() => {
        Saxophone.parseAttrs(' first');
    }, /Expected a value for the attribute/);
});

test('should not parse invalid attribute names', () => {
    assert.throws(() => {
        Saxophone.parseAttrs(' this is an attribute="value"');
    }, /Attribute names may not contain whitespace/);
});

test('should not parse unquoted attribute values', () => {
    assert.throws(() => {
        Saxophone.parseAttrs(' attribute=value value=invalid');
    }, /Attribute values should be quoted/);
});

test('should not parse misquoted attribute values', () => {
    assert.throws(() => {
        Saxophone.parseAttrs(' attribute="value\'');
    }, /Unclosed attribute value/);
});
