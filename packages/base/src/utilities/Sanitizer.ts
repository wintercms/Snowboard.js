import Singleton from '../abstracts/Singleton';

/**
 * Sanitizer utility.
 *
 * Client-side HTML sanitizer designed mostly to prevent self-XSS attacks.
 * The sanitizer utility will strip all attributes that start with `on` (usually JS event handlers
 * as attributes, i.e. `onload` or `onerror`) or contain the `javascript:` pseudo protocol in their
 * values.
 *
 * This is only a simple sanitizer and does not attempt to be exhaustive. If you're truly paranoid
 * about the input, you might want to consider a more robust sanitizer like
 * [DOMPurify](https://github.com/cure53/DOMPurify).
 *
 * @author Ben Thomson <git@alfreido.com>
 */
export default class Sanitizer extends Singleton {
    /**
     * Sanitizes a HTML string.
     */
    sanitize(html: string, bodyOnly: boolean = true): string {
        const parser = new DOMParser();
        const dom = parser.parseFromString(html, 'text/html');

        this.sanitizeNode(dom.getRootNode() as Element);

        return (bodyOnly) ? dom.body.innerHTML : dom.documentElement.outerHTML;
    }

    /**
     * Sanitizes an individual node.
     */
    sanitizeNode(node: Element): void {
        if (['SCRIPT', 'IFRAME', 'OBJECT'].includes(node.tagName)) {
            node.remove();
            return;
        }

        this.trimAttributes(node);

        const children = Array.from(node.children);

        children.forEach((child) => {
            this.sanitizeNode(child);
        });
    }

    /**
     * Sanitizes the attributes of a node.
     */
    trimAttributes(node: Element): void {
        if (!node.attributes) {
            return;
        }

        for (let i = 0; i < node.attributes.length; i += 1) {
            const attrName = node.attributes.item(i)?.name;
            const attrValue = node.attributes.item(i)?.value;

            if (!attrName || !attrValue) {
                continue;
            }

            /*
            * remove attributes where the names start with "on" (for example: onload, onerror...)
            * remove attributes where the value starts with the "javascript:" pseudo protocol
            * (for example `href="javascript:alert(1)"`)
            */
            /* eslint-disable-next-line no-script-url */
            if (attrName.indexOf('on') === 0 || attrValue.indexOf('javascript:') === 0) {
                node.removeAttribute(attrName);
            }
        }
    }
}
