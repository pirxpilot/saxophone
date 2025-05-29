const { findIndexOutside } = require('./util');

/**
 * Information about a text node.
 *
 * @typedef TextNode
 * @type {object}
 * @prop {string} contents The text value.
 */

/**
 * Emitted whenever a text node is encountered.
 *
 * @event Saxophone#text
 * @type {TextNode}
 */

/**
 * Information about a CDATA node
 * (<![CDATA[ ... ]]>).
 *
 * @typedef CDATANode
 * @type {object}
 * @prop {string} contents The CDATA contents.
 */

/**
 * Emitted whenever a CDATA node is encountered.
 *
 * @event Saxophone#cdata
 * @type {CDATANode}
 */

/**
 * Information about a comment node
 * (<!-- ... -->).
 *
 * @typedef CommentNode
 * @type {object}
 * @prop {string} contents The comment contents
 */

/**
 * Emitted whenever a comment node is encountered.
 *
 * @event Saxophone#comment
 * @type {CommentNode}
 */

/**
 * Information about a processing instruction node
 * (<? ... ?>).
 *
 * @typedef ProcessingInstructionNode
 * @type {object}
 * @prop {string} contents The instruction contents
 */

/**
 * Emitted whenever a processing instruction node is encountered.
 *
 * @event Saxophone#processinginstruction
 * @type {ProcessingInstructionNode}
 */

/**
 * Information about an opened tag
 * (<tag attr="value">).
 *
 * @typedef TagOpenNode
 * @type {object}
 * @prop {string} name Name of the tag that was opened.
 * @prop {string} attrs Attributes passed to the tag, in a string representation
 * (use Saxophone.parseAttributes to get an attribute-value mapping).
 * @prop {bool} isSelfClosing Whether the tag self-closes (tags of the form
 * `<tag />`). Such tags will not be followed by a closing tag.
 */

/**
 * Emitted whenever an opening tag node is encountered.
 *
 * @event Saxophone#tagopen
 * @type {TagOpen}
 */

/**
 * Information about a closed tag
 * (</tag>).
 *
 * @typedef TagCloseNode
 * @type {object}
 * @prop {string} name The tag name
 */

/**
 * Emitted whenever a closing tag node is encountered.
 *
 * @event Saxophone#tagclose
 * @type {TagCloseNode}
 */

function createSink({ emit }) {
  // Stack of tags that were opened up until the current cursor position
  const _tagStack = [];

  // Not waiting initially
  let _waiting = null;

  /**
   * Put the stream into waiting mode, which means we need more data
   * to finish parsing the current token.
   *
   * @param token Type of token that is being parsed.
   * @param data Pending data.
   */
  function _wait(token, data) {
    _waiting = { token, data };
  }

  /**
   * Put the stream out of waiting mode.
   *
   * @return Any data that was pending.
   */
  function _unwait() {
    if (_waiting === null) {
      return '';
    }

    const { data } = _waiting;
    _waiting = null;
    return data;
  }

  /**
   * Handle the opening of a tag in the text stream.
   *
   * Push the tag into the opened tag stack and emit the
   * corresponding event on the event emitter.
   *
   * @param {TagOpen} node Information about the opened tag.
   */
  function _handleTagOpening(node) {
    if (!node.isSelfClosing) {
      _tagStack.push(node.name);
    }

    emit('tagopen', node);
  }

  /**
   * Parse a XML chunk.
   *
   * @param {string} input A string with the chunk data.
   * @param {function} callback Called when the chunk has been parsed, with
   * an optional error argument.
   */
  function _parseChunk(input) {
    // Use pending data if applicable and get out of waiting mode
    input = _unwait() + input;

    let chunkPos = 0;
    const end = input.length;

    while (chunkPos < end) {
      if (input[chunkPos] !== '<') {
        const nextTag = input.indexOf('<', chunkPos);

        // We read a TEXT node but there might be some
        // more text data left, so we wait
        if (nextTag === -1) {
          _wait('text', input.slice(chunkPos));
          break;
        }

        // A tag follows, so we can be confident that
        // we have all the data needed for the TEXT node
        emit('text', { contents: input.slice(chunkPos, nextTag) });

        chunkPos = nextTag;
      }

      // Invariant: the cursor now points on the name of a tag,
      // after an opening angled bracket
      chunkPos += 1;
      const nextChar = input[chunkPos];

      // Begin a DOCTYPE, CDATA or comment section
      if (nextChar === '!') {
        chunkPos += 1;
        const nextNextChar = input[chunkPos];

        // Unclosed markup declaration section of unknown type,
        // we need to wait for upcoming data
        if (nextNextChar === undefined) {
          _wait('markupDeclaration', input.slice(chunkPos - 2));
          break;
        }

        if (nextNextChar === '[' && 'CDATA['.indexOf(input.slice(chunkPos + 1, chunkPos + 7)) > -1) {
          chunkPos += 7;
          const cdataClose = input.indexOf(']]>', chunkPos);

          // Incomplete CDATA section, we need to wait for
          // upcoming data
          if (cdataClose === -1) {
            _wait('cdata', input.slice(chunkPos - 9));
            break;
          }

          emit('cdata', { contents: input.slice(chunkPos, cdataClose) });

          chunkPos = cdataClose + 3;
          continue;
        }

        if (nextNextChar === '-' && (input[chunkPos + 1] === undefined || input[chunkPos + 1] === '-')) {
          chunkPos += 2;
          const commentClose = input.indexOf('--', chunkPos);

          // Incomplete comment node, we need to wait for
          // upcoming data
          if (commentClose === -1 || input[commentClose + 2] === undefined) {
            _wait('comment', input.slice(chunkPos - 4));
            break;
          }

          if (input[commentClose + 2] !== '>') {
            throw new Error(`Unexpected -- inside comment: '${input.slice(chunkPos - 4)}'`);
          }

          emit('comment', { contents: input.slice(chunkPos, commentClose) });

          chunkPos = commentClose + 3;
          continue;
        }

        // TODO: recognize DOCTYPEs here
        throw new Error('Unrecognized sequence: <!' + nextNextChar);
      }

      if (nextChar === '?') {
        chunkPos += 1;
        const piClose = input.indexOf('?>', chunkPos);

        // Unclosed processing instruction, we need to
        // wait for upcoming data
        if (piClose === -1) {
          _wait('processinginstruction', input.slice(chunkPos - 2));
          break;
        }

        emit('processinginstruction', { contents: input.slice(chunkPos, piClose) });

        chunkPos = piClose + 2;
        continue;
      }

      // Recognize regular tags (< ... >)
      const tagClose = findIndexOutside(input, char => char === '>', '"', chunkPos);

      if (tagClose === -1) {
        _wait('tagopen', input.slice(chunkPos - 1));
        break;
      }

      // Check if the tag is a closing tag
      if (input[chunkPos] === '/') {
        const tagName = input.slice(chunkPos + 1, tagClose);
        const stackedTagName = _tagStack.pop();

        if (stackedTagName !== tagName) {
          _tagStack.length = 0;
          throw new Error(`Unclosed tag: ${stackedTagName}`);
        }

        emit('tagclose', { name: tagName });

        chunkPos = tagClose + 1;
        continue;
      }

      // Check if the tag is self-closing
      const isSelfClosing = input[tagClose - 1] === '/';
      const realTagClose = isSelfClosing ? tagClose - 1 : tagClose;

      // Extract the tag name and attributes
      const whitespace = input.slice(chunkPos).search(/\s/);

      if (whitespace === -1 || whitespace >= tagClose - chunkPos) {
        // Tag without any attribute
        _handleTagOpening({
          name: input.slice(chunkPos, realTagClose),
          attrs: '',
          isSelfClosing
        });
      } else if (whitespace === 0) {
        throw new Error('Tag names may not start with whitespace');
      } else {
        // Tag with attributes
        _handleTagOpening({
          name: input.slice(chunkPos, chunkPos + whitespace),
          attrs: input.slice(chunkPos + whitespace, realTagClose),
          isSelfClosing
        });
      }

      chunkPos = tagClose + 1;
    }
  }

  function write(chunk) {
    return _parseChunk(chunk);
  }

  /**
   * Handle the end of incoming data.
   *
   * @param {function} callback
   */
  function close() {
    // Make sure all data has been extracted from the decoder
    _parseChunk('');

    // Handle unclosed nodes
    if (_waiting !== null) {
      switch (_waiting.token) {
        case 'text':
          // Text nodes are implicitly closed
          emit('text', { contents: _waiting.data });
          break;
        case 'cdata':
          throw new Error('Unclosed CDATA section');
        case 'comment':
          throw new Error('Unclosed comment');
        case 'processinginstruction':
          throw new Error('Unclosed processing instruction');
        case 'tagopen':
        case 'tagclose':
          // We do not distinguish between unclosed opening
          // or unclosed closing tags
          throw new Error('Unclosed tag');
        default:
        // Pass
      }
    }

    if (_tagStack.length !== 0) {
      throw new Error(`Unclosed tags: ${_tagStack.join(',')}`);
    }
  }

  return {
    write,
    close
  };
}

/* global WritableStream */

/**
 * Parse a XML stream and emit events corresponding
 * to the different tokens encountered.
 *
 * @extends WritableStream
 *
 */
class Saxophone extends WritableStream {
  /**
   * Create a new parser instance.
   */
  constructor(target) {
    super(createSink({ emit }));

    function emit(name, detail) {
      const ev = new CustomEvent(name, { detail });
      target.dispatchEvent(ev);
    }
  }

  /**
   * Immediately parse a complete chunk of XML and close the stream.
   *
   * @param {string} input Input chunk.
   */
  async parse(input) {
    const writer = this.getWriter();
    await writer.ready;
    await writer.write(input);
  }
}

module.exports = Saxophone;
