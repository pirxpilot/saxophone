
1.0.0 / 2023-09-13
==================

 * rename to @pirxpilot/saxophone
 * reimplement using WriteableStream and EventTarget

## v0.8.0

### Breaking changes

* Node v10, v12, and v15 reached end-of-life and are no longer supported.
* Add support for Node v16 and v18.
* `Saxophone` no longer emits the `finish` event after a parsing error occurs (see <https://github.com/nodejs/node/pull/28979>).

## v0.7.2

### Fixed bugs

* Fix parse error when a comment’s ending sequence sits astride two chunks (`--` in the first and `>` in the second).

## v0.7.1

### Fixed bugs

* Fix parse error on attribute values containing '>'

## v0.7.0

### Breaking changes

* Node v8 and v13 reached end-of-life and are no longer supported.
* Add support for Node v14 and v15.

## v0.6.1

### Breaking changes

* Node v6 reached end-of-life and is no longer supported.

### Fixed bugs

* Properly process CDATA and comment tags that sits astride two chunks.

## v0.5.0

### New features

* Report an error when opening and closing tags are mismatched or omitted.

## v0.4.3

### Minor changes

* Stop publishing the module as a transpiled source file, as all supported Node versions are compatible with the syntax that we use.

## v0.4.0

### Breaking changes

* Node v4 and v9 reached end-of-life and are no longer supported.

## v0.3.0

### Breaking changes

* `Saxophone()` is now a constructor and no longer a factory function, so it should be prefixed by the `new` operator. Otherwise, an error will be thrown stating that a class cannot be called as a function.
* Node v0.12 and v5 reached end-of-life and are no longer supported.

### New features

* Instances now support streaming through the Node.js stream API. The previous `Saxophone#parse` API is still supported.

## v0.2.0

### Breaking changes

* To improve performance, attributes are no longer automatically parsed for every tag. Users should call `Saxophone#parseAttrs` whenever they actually want the attributes parsed.
* To improve performance, entities are no longer automatically decoded for every text chunk. Users should call `Saxophone#parseEntities` whenever they actually want to decode entities from a text.
