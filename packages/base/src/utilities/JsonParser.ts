import JSON5 from 'json5';
import Singleton from '../abstracts/Singleton';

interface JsonTokens {
    keys: string[];
    values: any[];
    strings: string[];
    objects: any[];
    arrays: any[];
}

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
 *   "baz": "buzz"}"`. (Only in non-strict mode)
 * - A string that is not quoted but contains a comma and is not wrapped with array boundaries,
 *   will be considered an array. ie: `foo, bar, baz` will be considered `["foo", "bar", "baz"]`.
 *   (Only in non-strict mode)
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
     * catch some more common issues and fix them before attempting to run through the JSON5 parser
     * again.
     *
     * If `strict` is true, it will not try and correct any missing object or array boundaries on
     * the root element, and will instead assume a string has been given from the outset.
     */
    parse(str: string, strict: boolean = false): any {
        // Handle special cases
        if (str === 'undefined') {
            return undefined;
        }

        try {
            // First pass at parsing
            return JSON5.parse(str);
        } catch (e) {
            // Try to prepare string and then parse again
            const jsonString = this.prepareString(String(str), strict);

            return JSON5.parse(jsonString);
        }
    }

    /**
     * Prepares a string for a second-pass at parsing.
     */
    prepareString(str: string, strict: boolean): string {
        // Tokenize the string before we process further
        const tokens: JsonTokens = {
            keys: [],
            values: [],
            strings: [],
            objects: [],
            arrays: [],
        };

        const tokenized = this.tokenize(str, tokens).trim();

        // After tokenization, determine if we have an object, an array or a string
        if (tokenized.includes(':') && !strict) {
            return `{ ${this.detokenize(tokenized, tokens)} }`;
        }
        if (tokenized.includes(',') && !strict) {
            return `[ ${this.detokenize(tokenized, tokens)} ]`;
        }
        if (tokenized.match(/^__[A-Z]{3}\$\(\d+\)__$/)) {
            return this.detokenize(tokenized, tokens);
        }

        // Assume we're dealing with a string
        return `"${str.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }

    /**
     * Tokenizes JSON boundaries in a string.
     */
    tokenize(str: string, tokens: JsonTokens): string {
        const tokenized = str.trim().replace(/('[^']+'|"[^"]+"|\{.*?\}\s*(?=[,{\]]|$)|\[.*\]\s*(?=[,{\]]|$))/gs, (match) => {
            const trimmed = match.trim();

            if (trimmed.substring(0, 1) === '\'' || trimmed.substring(0, 1) === '"') {
                tokens.strings.push(trimmed);
                return `__STR$(${(tokens.strings.length - 1)})__`;
            }

            if (trimmed.substring(0, 1) === '{') {
                const obj = this.tokenize(trimmed.substring(1, trimmed.length - 1), tokens);
                tokens.objects.push(obj);
                return `__OBJ$(${(tokens.objects.length - 1)})__`;
            }

            const obj = this.tokenize(trimmed.substring(1, trimmed.length - 1), tokens);
            tokens.arrays.push(obj);
            return `__ARR$(${(tokens.arrays.length - 1)})__`;
        });

        // Work out key/pair values for objects, or values for arrays, and tokenise these too.
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
    detokenize(tokenized: string, tokens: JsonTokens): string {
        return tokenized.replace(/__([A-Z]{3})\$\((\d+)\)__/g, (match, tokenCode, tokenIndex) => {
            switch (tokenCode) {
                case 'STR':
                    return tokens.strings[tokenIndex].replace(/\n/g, '\\n');
                case 'KEY':
                    return `"${tokens.keys[tokenIndex]}"`;
                case 'VAL':
                    try {
                        return JSON5.parse(tokens.values[tokenIndex].replace(/\n/g, '\\n'));
                    } catch (e) {
                        return `"${tokens.values[tokenIndex].replace(/\n/g, '\\n')}"`;
                    }
                case 'ARR':
                    return `[ ${this.detokenize(tokens.arrays[tokenIndex], tokens)} ]`;
                default:
                    return `{ ${this.detokenize(tokens.objects[tokenIndex], tokens)} }`;
            }
        });
    }
}
