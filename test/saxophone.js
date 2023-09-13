const test = require('node:test');
const assert = require('node:assert/strict');

const uniq = require('lodash.uniq');
const tags = require('common-tags');

const Saxophone = require('../lib/saxophone');

/* global ReadableStream, EventTarget */

/**
 * Verify that an XML text is parsed as the specified stream of events.
 *
 * @param assert Assertion function.
 * @param xml XML string or array of XML chunks.
 * @param events Sequence of events that must be emitted in order.
 */
async function expectEvents(xml, events) {
  let eventsIndex = 0;
  const target = new EventTarget();
  const parser = new Saxophone(target);

  const eventNames = uniq(events.map(([name]) => name));
  eventNames.forEach(eventName => target.addEventListener(eventName, onEvent));

  try {
    const from = createReadableStream(xml);
    await from.pipeTo(parser);
  } catch (error) {
    const [expEventName, expEventArgs] = events[eventsIndex++];
    assert.equal('error', expEventName, 'should expect an error');
    assert.equal(error.message, expEventArgs.message, 'should have matching error message');
  } finally {
    assert.equal(eventsIndex, events.length, 'should process all events');
  }

  function onEvent(event) {
    const { type, detail } = event;
    const [expType, expDetail] = events[eventsIndex++];

    assert.equal(type, expType, `should trigger on${expType}`);
    if (expDetail != null) {
      assert.deepEqual(detail, expDetail, 'should emit with parsed data');
    }
  }
}

test('should parse comments', () =>
  expectEvents(
    '<!-- this is a comment -->',
    [
      ['comment', { contents: ' this is a comment ' }]
    ]
  ));

test('should parse comments between two chunks', () =>
  expectEvents(
    ['<', '!', '-', '-', ' this is a comment -->'],
    [
      ['comment', { contents: ' this is a comment ' }]
    ]
  ));

test('should parse comments ending between two chunks', () =>
  expectEvents(
    ['<!-- this is a comment --', '>'],
    [
      ['comment', { contents: ' this is a comment ' }]
    ]
  ));

test('should not parse unclosed comments', () =>
  expectEvents(
    '<!-- this is a comment ->',
    [
      ['error', new Error('Unclosed comment')]
    ]
  ));

test('should not parse invalid comments', () =>
  expectEvents(
    '<!-- this is an -- invalid comment ->',
    [
      [
        'error',
        new Error("Unexpected -- inside comment: '<!-- this is an -- invalid '")
      ]
    ]
  ));

test('should parse CDATA sections', () =>
  expectEvents(
    '<![CDATA[this is a c&data s<>ction]]>',
    [
      ['cdata', { contents: 'this is a c&data s<>ction' }]
    ]
  ));

test('should parse CDATA sections between two chunks', () =>
  expectEvents(
    ['<', '!', '[', 'C', 'D', 'A', 'T', 'A', '[', 'contents]]>'],
    [
      ['cdata', { contents: 'contents' }]
    ]
  ));

test('should not parse invalid CDATA sections', () =>
  expectEvents(
    ['<![CDAthis is NOT a c&data s<>ction]]>'],
    [
      ['error', new Error('Unrecognized sequence: <![')]
    ]
  ));

test('should not parse unclosed CDATA sections', () =>
  expectEvents(
    '<![CDATA[this is a c&data s<>ction]>',
    [
      ['error', new Error('Unclosed CDATA section')]
    ]
  ));

test('should parse processing instructions', () =>
  expectEvents(
    '<?xml version="1.0" encoding="UTF-8" ?>',
    [
      ['processinginstruction', { contents: 'xml version="1.0" encoding="UTF-8" ' }]
    ]
  ));

test('should not parse unclosed processing instructions', () =>
  expectEvents(
    '<?xml version="1.0" encoding="UTF-8">',
    [
      ['error', new Error('Unclosed processing instruction')]
    ]
  ));

test('should parse simple tags', () =>
  expectEvents(
    '<tag></tag>',
    [
      ['tagopen', { name: 'tag', attrs: '', isSelfClosing: false }],
      ['tagclose', { name: 'tag' }]
    ]
  ));

test('should not parse unclosed opening tags', () =>
  expectEvents(
    '<tag',
    [
      ['error', new Error('Unclosed tag')]
    ]
  ));

test('should not parse unclosed tags 2', () =>
  expectEvents(
    '<tag>',
    [
      ['error', new Error('Unclosed tags: tag')]
    ]
  ));

test('should not parse unclosed tags 3', () =>
  expectEvents(
    '<closed><unclosed></closed>',
    [
      ['tagopen', { name: 'closed', attrs: '', isSelfClosing: false }],
      ['tagopen', { name: 'unclosed', attrs: '', isSelfClosing: false }],
      ['error', new Error('Unclosed tag: unclosed')],
    ]
  ));

test('should not parse DOCTYPEs', () =>
  expectEvents(
    '<!DOCTYPE html>',
    [
      ['error', new Error('Unrecognized sequence: <!D')]
    ]
  ));

test('should not parse invalid tags', () =>
  expectEvents(
    '< invalid>',
    [
      ['error', new Error('Tag names may not start with whitespace')]
    ]
  ));

test('should parse self-closing tags', () =>
  expectEvents(
    '<test />',
    [
      ['tagopen', { name: 'test', attrs: ' ', isSelfClosing: true }]
    ]
  ));

test('should parse closing tags', () =>
  expectEvents(
    '<closed></closed>',
    [
      ['tagopen', { name: 'closed', attrs: '', isSelfClosing: false }],
      ['tagclose', { name: 'closed' }]
    ]
  ));

test('should not parse unclosed closing tags', () =>
  expectEvents(
    '</closed',
    [
      ['error', new Error('Unclosed tag')]
    ]
  ));

test('should parse tags with attributes', () =>
  expectEvents(
    '<tag first="one" second="two"  third="three " /><other attr="value"></other>',
    [
      ['tagopen', { name: 'tag', attrs: ' first="one" second="two"  third="three " ', isSelfClosing: true }],
      ['tagopen', { name: 'other', attrs: ' attr="value"', isSelfClosing: false }],
      ['tagclose', { name: 'other' }]
    ]
  ));

test('should parse tags with attributes containing ">"', () =>
  expectEvents(
    '<tag assert="5 > 1" />',
    [
      ['tagopen', { name: 'tag', attrs: ' assert="5 > 1" ', isSelfClosing: true }],
    ]
  ));

test('should parse text nodes', () =>
  expectEvents(
    '<textarea> this\nis\na\r\n\ttextual\ncontent  </textarea>',
    [
      ['tagopen', { name: 'textarea', attrs: '', isSelfClosing: false }],
      ['text', { contents: ' this\nis\na\r\n\ttextual\ncontent  ' }],
      ['tagclose', { name: 'textarea' }]
    ]
  ));

test('should parse text nodes outside of the root element', () =>
  expectEvents(
    'before<root>inside</root>after',
    [
      ['text', { contents: 'before' }],
      ['tagopen', { name: 'root', attrs: '', isSelfClosing: false }],
      ['text', { contents: 'inside' }],
      ['tagclose', { name: 'root' }],
      ['text', { contents: 'after' }]
    ]
  ));

test('should parse a complete document', () =>
  expectEvents(
    tags.stripIndent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <persons>
                <!-- List of persons -->
                <person name="Priscilla Z. Holden" address="320-2518 Taciti Street" />
                <person name="Raymond J. Garner" address="698-806 Dictum Road" />
                <person name="Alfonso T. Yang" address="3689 Dolor Rd." />
            </persons>
        `,
    [
      ['processinginstruction', { contents: 'xml version="1.0" encoding="UTF-8" ' }],
      ['text', { contents: '\n' }],
      ['tagopen', { name: 'persons', attrs: '', isSelfClosing: false }],
      ['text', { contents: '\n    ' }],
      ['comment', { contents: ' List of persons ' }],
      ['text', { contents: '\n    ' }],
      ['tagopen', { name: 'person', attrs: ' name="Priscilla Z. Holden" address="320-2518 Taciti Street" ', isSelfClosing: true }],
      ['text', { contents: '\n    ' }],
      ['tagopen', { name: 'person', attrs: ' name="Raymond J. Garner" address="698-806 Dictum Road" ', isSelfClosing: true }],
      ['text', { contents: '\n    ' }],
      ['tagopen', { name: 'person', attrs: ' name="Alfonso T. Yang" address="3689 Dolor Rd." ', isSelfClosing: true }],
      ['text', { contents: '\n' }],
      ['tagclose', { name: 'persons' }]
    ]
  ));

test('streaming and full parse should result in the same events', async () => {
  const xml = tags.stripIndent`
        <?xml version="1.0" encoding="UTF-8" ?>
        <persons>
            <!-- List of persons -->
            <person name="Priscilla Z. Holden" address="320-2518 Taciti Street" />
            <person name="Raymond J. Garner" address="698-806 Dictum Road" />
            <person name="Alfonso T. Yang" address="3689 Dolor Rd." />
        </persons>
    `;

  const target1 = new EventTarget();
  const parser1 = new Saxophone(target1);
  const events1 = [];

  const target2 = new EventTarget();
  const parser2 = new Saxophone(target2);
  const events2 = [];

  [
    'text',
    'cdata',
    'comment',
    'processinginstruction',
    'tagopen',
    'tagclose'
  ].forEach(type => {
    target1.addEventListener(type, event => events1.push(event));
    target2.addEventListener(type, event => events2.push(event));
  });

  await Promise.all([
    // parser1 receives the whole data once
    parser1.parse(xml),

    // parser2 receives the data as several chunks through a piped stream
    createReadableStream(xml).pipeTo(parser2)
  ]);


  console.log('Here!');
  assert.equal(events1.length, events2.length);
  for (let i = 0; i < events1.length; i++) {
    const { type, detail } = events1[i];
    const event2 = events2[i];
    assert.equal(type, event2.type, `should match event types for step ${i}`);
    assert.deepEqual(detail, event2.detail, `should match event detail for step ${i}`);
  }
});

function createReadableStream(xml, size = 9) {
  const chunks = toChunks(xml, size);
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i >= chunks.length) {
        controller.close();
      } else {
        const chunk = await chunks[i++];
        controller.enqueue(chunk);
      }
    },
  });
}

// By default, split data in chunks of size 10
function toChunks(xml, size = 10) {
  if (Array.isArray(xml)) {
    return xml;
  }
  const chunks = [];
  for (let i = 0, j = size; i < xml.length; i = j, j += size) {
    chunks.push(xml.slice(i, j));
  }
  return chunks;
}
