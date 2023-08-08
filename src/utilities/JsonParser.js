import JSON5 from 'json5';
import Singleton from '../abstracts/Singleton';

/**
 * JSON Parser utility.
 *
 * This utility parses JSON-like data that does not strictly meet the JSON specifications in order
 * to simplify development. It uses the JSON5 library under the hood, but adds in some additional
 * parsing logic (in order of precedence):
 *
 * - An unquoted string, without a comma, colon, or object or array boundaries, will be considered
 *   a string. ie: `foo` will be considered `"foo"`.
 * - A string that is not quoted but contains a colon and is not wrapped with object boundaries,
 *   will be considered an object. ie: `foo: bar, baz: buzz` will be considered `"{"foo": "bar",
 *   "baz": "buzz"}"`.
 * - A string that is not quoted but contains a comma and is not wrapped with array boundaries,
 *   will be considered an array. ie: `foo, bar, baz` will be considered `["foo", "bar", "baz"]`.
 * - Keys and values inside of objects and arrays will be parsed as strings unless they match a
 *   specific syntax.
 *
 * @author Ben Thomson <git@alfreido.com>
 */
export default class JsonParser extends Singleton {
    /**
     * Attempts to parse a JSON string into a JavaScript object.
     *
     * First, it attempts to parse the string through JSON5 parser, a more "relaxed" JSON parser
     * which is still semantically JavaScript. If this fails, it will tokenize the string and
     * catch some
     *
     * @param {string} str
     * @returns {any}
     */
    parse(str) {
        // Handle special cases
        if (str === 'undefined') {
            return undefined;
        }

        try {
            // First pass at parsing
            return JSON5.parse(str);
        } catch (e) {
            // Try to prepare string and then parse again
            const jsonString = this.prepareString(String(str));

            return JSON5.parse(jsonString);
        }
    }

    /**
     * Prepares a string for a second-pass at parsing.
     *
     * @param {string} str
     * @returns {string}
     */
    prepareString(str) {
        // Tokenize the string before we process further
        const tokens = {
            keys: [],
            values: [],
            strings: [],
            objects: [],
            arrays: [],
        };

        const tokenized = this.tokenize(str, tokens).trim();

        // After tokenization, determine if we have an object, an array or a string
        if (tokenized.includes(':')) {
            return `{ ${this.detokenize(tokenized, tokens)} }`;
        }
        if (tokenized.includes(',')) {
            return `[ ${this.detokenize(tokenized, tokens)} ]`;
        }
        if (tokenized.match(/^__[A-Z]{3}\$\(\d+\)__$/)) {
            return this.detokenize(tokenized, tokens);
        }

        // Assume we're dealing with a string
        return `"${str}"`;
    }

    /**
     * Tokenizes JSON boundaries in a string.
     *
     * @param {string} str
     * @param {Object} tokens
     * @returns {string}
     */
    tokenize(str, tokens) {
        const tokenized = str.trim().replace(/('[^']+'|"[^"]+"|\{.*?\}\s*(?=[,{\]]|$)|\[.*\](?=[,{\]]|$))/g, (match) => {
            if (match.substring(0, 1) === '\'' || match.substring(0, 1) === '"') {
                tokens.strings.push(match);
                return `__STR$(${(tokens.strings.length - 1)})__`;
            }

            if (match.substring(0, 1) === '{') {
                const obj = this.tokenize(match.substring(1, match.length - 1), tokens);
                tokens.objects.push(obj);
                return `__OBJ$(${(tokens.objects.length - 1)})__`;
            }

            const obj = this.tokenize(match.substring(1, match.length - 1), tokens);
            tokens.arrays.push(obj);
            return `__ARR$(${(tokens.arrays.length - 1)})__`;
        });

        let pairs = [];

        if (tokenized.includes(',')) {
            pairs = tokenized.split(',');
        } else if (tokenized.includes(':')) {
            pairs = [tokenized];
        } else {
            return tokenized;
        }

        return pairs.map((pair) => {
            let newValue = '';

            if (pair.includes(':')) {
                const [key, value] = pair.split(':');

                if (!key.trim().match(/^__[A-Z]{3}\$\(\d+\)__$/)) {
                    tokens.keys.push(key.trim());
                    newValue = `__KEY$(${(tokens.keys.length - 1)})__`;
                } else {
                    newValue = key.trim();
                }

                if (!value.trim().match(/^__[A-Z]{3}\$\(\d+\)__$/)) {
                    tokens.values.push(value.trim());
                    newValue = `${newValue}: __VAL$(${(tokens.values.length - 1)})__`;
                } else {
                    newValue = `${newValue}: ${value.trim()}`;
                }
            } else if (!pair.trim().match(/^__[A-Z]{3}\$\(\d+\)__$/)) {
                tokens.values.push(pair.trim());
                newValue = `${newValue}__VAL$(${(tokens.values.length - 1)})__`;
            } else {
                newValue = pair.trim();
            }

            return newValue;
        }).join(', ');
    }

    /**
     * Detokenizes a tokenized string, applying fixes for certain tokens that may have been
     * incorrectly entered.
     *
     * @param {string} tokenized
     * @param {Object} tokens
     * @returns {string}
     */
    detokenize(tokenized, tokens) {
        return tokenized.replace(/__([A-Z]{3})\$\((\d+)\)__/g, (match, tokenCode, tokenIndex) => {
            switch (tokenCode) {
                case 'STR':
                    return tokens.strings[tokenIndex];
                case 'KEY':
                    return `"${tokens.keys[tokenIndex]}"`;
                case 'VAL':
                    try {
                        return JSON5.parse(tokens.values[tokenIndex]);
                    } catch (e) {
                        return `"${tokens.values[tokenIndex]}"`;
                    }
                case 'ARR':
                    return `[ ${this.detokenize(tokens.arrays[tokenIndex], tokens)} ]`;
                default:
                    return `{ ${this.detokenize(tokens.objects[tokenIndex], tokens)} }`;
            }
        });
    }
}
