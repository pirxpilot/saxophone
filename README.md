[![NPM version][npm-image]][npm-url]
[![Build Status][build-image]][build-url]
[![Dependency Status][deps-image]][deps-url]

# @pirxpilot/Saxophone 🎷

This is a fork of [Saxophone] - fast and lightweight event-driven streaming XML parser - reimplemented using only browser primitves: `EventTarget` and `WritableStream`

[Saxophone] is inspired by SAX parsers such as [sax-js](https://github.com/isaacs/sax-js) and [EasySax](https://github.com/vflash/easysax): unlike most XML parsers, it does not create a Document Object Model ([DOM](https://en.wikipedia.org/wiki/Document_Object_Model)) tree as a result of parsing documents.
Instead, it emits events for each tag or text node encountered as the parsing goes on, which makes it an online algorithm.
This means that Saxophone has a low memory footprint, can easily parse large documents, and can parse documents as they come from a stream.

The parser does not keep track of the document state while parsing and, in particular, does not check whether the document is well-formed or valid, making it super-fast (see the [benchmark](#Benchmark) below).

This library is best suited when you need to extract simple data out of an XML document that you know is well-formed. The parser will not report precise errors in case of syntax problems. An example would be reading data from an API endpoint.

## Installation

This library works both on Node.JS and recent browsers.
To install with `npm`:

```sh
$ npm install --save @pirxpilot/saxophone
```

## Examples

### Simple example

```js
const Saxophone = require('saxophone');
const target = new EventTarget();
const parser = new Saxophone(target);

// Called whenever an opening tag is found in the document,
// such as <example id="1" /> - see below for a list of events
target.addEventListener('tagopen', ({ detail: tag }) => {
    console.log(
        'Open tag %s with attributes: %j',
        tag.name,
        Saxophone.parseAttrs(tag.attrs)
    );
});

// Triggers parsing - remember to set up listeners before
// calling this method
await parser.parse('<root><example id="1" /><example id="2" /></root>');
console.log('Parsing finished.');
```

Output:

```sh
Open tag "root" with attributes: {}.
Open tag "example" with attributes: {"id":"1"}.
Open tag "example" with attributes: {"id":"2"}.
Parsing finished.
```

### Streaming example

Same example as above but with `Stream`s.

```js
const Saxophone = require('saxophone');
const target = new EventTarget();
const parser = new Saxophone(target);

// Called whenever an opening tag is found in the document,
// such as <example id="1" /> - see below for a list of events
target.on('tagopen', ({ detail: tag }) => {
    console.log(
        'Open tag %s with attributes: %j',
        tag.name,
        Saxophone.parseAttrs(tag.attrs)
    );
});

// API returns '<root><example id="1" /><example id="2" /></root>'

const response = await fetch("https://example.com/api");
await response.body
  .pipeThrough(new TextDecoderStream('utf8'))
  .pipeTo(parser);

console.log('Parsing finished.');
```

Output:

```sh
Open tag "root" with attributes: {}.
Open tag "example" with attributes: {"id":"1"}.
Open tag "example" with attributes: {"id":"2"}.
Parsing finished.
```

## Documentation

### `new Saxophone(target)`

Creates a new Saxophone parser instance. This object is a writable stream that will emit an event for each tag or node parsed from the incoming data. See [the list of events below.](#events)

Arguments:

* `target` is an `EventTarget` on which event handlers can be registered


### `Saxophone#parse(xml)`

Trigger the parsing of a whole document. This method will fire registered listeners, so you need to set them up before calling it. This is equivalent to writing `xml` to the stream and closing it.

**Note:** the parser cannot be reused afterwards, you need to create a new instance.

Arguments:

* `xml` is a string containing the XML that you want to parse.

This method returns the parser instance.

### `Saxophone#write(xml)`

Parse a chunk of a XML document. This method will fire registered listeners so you need to set them up before calling it.

**Note:** an event is emitted for a tag or a node only when it has been closed. If the chunk starts a tag but does not close it, the tag will not be reported until it is closed by a later chunk.

Arguments:

* `xml` is a string containing a chunk of the XML that you want to parse.

### `Saxophone.parseAttrs(attrs)`

Parse a string list of XML attributes, as produced by the main parsing algorithm. This is not done automatically because it may not be required for every tag and it takes some time.

The result is an object associating the attribute names (as object keys) to their attribute values (as object values).

### `Saxophone.parseEntities(text)`

Parses a piece of XML text and expands all XML entities inside it to the character they represent. Just like attributes, this is not parsed automatically because it takes some time.

This ignores invalid entities, including unrecognized ones, leaving them as-is.

### Events

#### `tagopen`

Emitted when an opening tag is parsed. This encompasses both regular tags and self-closing tags. An object is passed with the following data:

* `name`: name of the parsed tag.
* `attrs`: attributes of the tag (as a string). To parse this string, use `Saxophone.parseAttrs`.
* `isSelfClosing`: true if the tag is self-closing.

#### `tagclose`

Emitted when a closing tag is parsed. An object containing the `name` of the tag is passed.

#### `processinginstruction`

Emitted when a processing instruction (such as `<? contents ?>`) is parsed. An object with the `contents` of the processing instruction is passed.

#### `text`

Emitted when a text node between two tags is parsed. An object with the `contents` of the text node is passed. You might need to expand XML entities inside the contents of the text node, using `Saxophone.parseEntities`.

#### `cdata`

Emitted when a CDATA section (such as `<![CDATA[ contents ]]>`) is parsed. An object with the `contents` of the CDATA section is passed.

#### `comment`

Emitted when a comment (such as `<!-- contents -->`) is parsed. An object with the `contents` of the comment is passed.

### Errors

Errors are thrown when a parsing error is encountered while reading the XML stream such that the rest of the XML cannot be correctly interpreted:

* when a DOCTYPE node is found (not supported yet);
* when a comment node contains the `--` sequence;
* when opening and closing tags are mismatched or missing;
* when a tag name starts with white space;
* when nodes are unclosed (missing their final `>`).

Because this library's goal is not to provide accurate error reports, the passed error will only contain a short description of the syntax error (without giving the position, for example).


## Contributions

This is free and open source software. All contributions (even small ones) are welcome. [Check out the contribution guide to get started!](CONTRIBUTING.md)

Thanks to:

* [Norman Rzepka](https://github.com/normanrz) for implementing the streaming API and the check for opening and closing tags mismatch.
* [winston01](https://github.com/winston01) for spotting and fixing an error in the parser when a tag sits astride two chunks.
* [MattGson](https://github.com/MattGson) for spotting another similar error.

## License

Released under the MIT license. [See the full license text.](LICENSE)

[Saxophone]: https://npmjs.org/package/saxophone

[npm-image]: https://img.shields.io/npm/v/@pirxpilot/saxophone
[npm-url]: https://npmjs.org/package/@pirxpilot/saxophone

[build-url]: https://github.com/pirxpilot/saxophone/actions/workflows/check.yaml
[build-image]: https://img.shields.io/github/actions/workflow/status/pirxpilot/saxophone/check.yaml?branch=main

[build-url]: https://github.com/pirxpilot/saxophone/actions/workflows/check.yaml
[build-image]: https://img.shields.io/github/actions/workflow/status/pirxpilot/saxophone/check.yaml?branch=main

[deps-image]: https://img.shields.io/librariesio/release/npm/@pirxpilot/saxophone
[deps-url]: https://libraries.io/npm/@pirxpilot%2Fsaxophone
