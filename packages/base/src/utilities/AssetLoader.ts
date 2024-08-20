import Singleton from '../abstracts/Singleton';

/**
 * Asset Loader.
 *
 * Provides simple asset loading functionality for Snowboard, making it easy to pre-load images or
 * include JavaScript or CSS assets on the fly.
 *
 * By default, this loader will listen to any assets that have been requested to load in an AJAX
 * response, such as responses from a component.
 *
 * You can also load assets manually by calling the following:
 *
 * ```js
 * Snowboard.addPlugin('assetLoader', AssetLoader);
 * Snowboard.assetLoader().processAssets(assets);
 * ```
 *
 * @copyright 2021 Winter.
 * @author Ben Thomson <git@alfreido.com>
 */
export default class AssetLoader extends Singleton {
    listens() {
        return {
            ajaxLoadAssets: 'load',
        };
    }

    dependencies() {
        return [
            'url',
        ];
    }

    /**
     * Process and load assets.
     *
     * The `assets` property of this method requires an object with any of the following keys and an
     * array of paths:
     *
     * - `js`: An array of JavaScript URLs to load
     * - `css`: An array of CSS stylesheet URLs to load
     * - `img`: An array of image URLs to pre-load
     *
     * Both `js` and `css` files will be automatically injected, however `img` files will not.
     *
     * This method will return a Promise that resolves when all required assets are loaded. If an
     * asset fails to load, this Promise will be rejected.
     */
    load(assets: { js?: string | string[], css?: string | string[], img?: string | string[] }): Promise<void[]> {
        const promises = [];

        if (assets.js) {
            if (typeof assets.js === 'string') {
                promises.push(this.loadScript(assets.js));
            } else if (Array.isArray(assets.js) && assets.js.length > 0) {
                assets.js.forEach((script) => {
                    promises.push(this.loadScript(script));
                });
            }
        }

        if (assets.css) {
            if (typeof assets.css === 'string') {
                promises.push(this.loadStyle(assets.css));
            } else if (Array.isArray(assets.css) && assets.css.length > 0) {
                assets.css.forEach((style) => {
                    promises.push(this.loadStyle(style));
                });
            }
        }

        if (assets.img) {
            if (typeof assets.img === 'string') {
                promises.push(this.loadImage(assets.img));
            } else if (Array.isArray(assets.img) && assets.img.length > 0) {
                assets.img.forEach((image) => {
                    promises.push(this.loadImage(image));
                });
            }
        }

        return Promise.all(promises);
    }

    /**
     * Injects and loads a JavaScript URL into the DOM.
     *
     * The script will be appended before the closing `</body>` tag.
     *
     * @param {String} script
     * @returns {Promise}
     */
    loadScript(script: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Resolve script URL
            const scriptUrl = this.snowboard.url().asset(script);

            // Check that script is not already loaded
            const loaded = document.querySelector(`script[src="${scriptUrl}"]`);
            if (loaded) {
                resolve();
                return;
            }

            // Create script
            const domScript = document.createElement('script');
            domScript.setAttribute('type', 'text/javascript');
            domScript.setAttribute('src', scriptUrl);
            domScript.addEventListener('load', () => {
                this.snowboard.globalEvent('assetLoader.loaded', 'script', script, domScript);
                resolve();
            });
            domScript.addEventListener('error', () => {
                this.snowboard.globalEvent('assetLoader.error', 'script', script, domScript);
                reject(new Error(`Unable to load script file: "${script}"`));
            });
            document.body.append(domScript);
        });
    }

    /**
     * Injects and loads a CSS stylesheet into the DOM.
     *
     * The stylesheet will be appended before the closing `</head>` tag.
     */
    loadStyle(style: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Resolve style URL
            const styleUrl = this.snowboard.url().asset(style);

            // Check that stylesheet is not already loaded
            const loaded = document.querySelector(`link[rel="stylesheet"][href="${styleUrl}"]`);
            if (loaded) {
                resolve();
                return;
            }

            // Create stylesheet
            const domCss = document.createElement('link');
            domCss.setAttribute('rel', 'stylesheet');
            domCss.setAttribute('href', styleUrl);
            domCss.addEventListener('load', () => {
                this.snowboard.globalEvent('assetLoader.loaded', 'style', style, domCss);
                resolve();
            });
            domCss.addEventListener('error', () => {
                this.snowboard.globalEvent('assetLoader.error', 'style', style, domCss);
                reject(new Error(`Unable to load stylesheet file: "${style}"`));
            });
            document.head.append(domCss);
        });
    }

    /**
     * Pre-loads an image.
     *
     * The image will not be injected into the DOM.
     */
    loadImage(image: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Resolve script URL
            const imageUrl = this.snowboard.url().asset(image);

            const img = new Image();
            img.addEventListener('load', () => {
                this.snowboard.globalEvent('assetLoader.loaded', 'image', image, img);
                resolve();
            });
            img.addEventListener('error', () => {
                this.snowboard.globalEvent('assetLoader.error', 'image', image, img);
                reject(new Error(`Unable to load image file: "${image}"`));
            });
            img.src = imageUrl;
        });
    }
}
