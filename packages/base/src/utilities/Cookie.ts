import BaseCookie from 'js-cookie';
import Singleton from '../abstracts/Singleton';

/**
 * Cookie utility.
 *
 * This utility is a thin wrapper around the "js-cookie" library.
 *
 * @see https://github.com/js-cookie/js-cookie
 * @copyright 2021 Winter.
 * @author Ben Thomson <git@alfreido.com>
 */
export default class Cookie extends Singleton {
    #defaults: Cookies.CookieAttributes = {
        expires: undefined,
        path: '/',
        domain: undefined,
        secure: false,
        sameSite: 'Lax',
    };

    /**
     * Set the default cookie parameters for all subsequent "set" and "remove" calls.
     */
    setDefaults(options?: Cookies.CookieAttributes): void {
        if (typeof options !== 'object') {
            throw new Error('Cookie defaults must be provided as an object');
        }

        this.#defaults = {
            ...this.#defaults,
            ...options,
        };
    }

    /**
     * Get the current default cookie parameters.
     */
    getDefaults() {
        return this.#defaults;
    }

    /**
     * Get a cookie by name.
     *
     * If `name` is undefined, returns all cookies as an Object.
     */
    get(name: string | undefined): string | { [key: string]: string } | undefined {
        if (name === undefined) {
            const cookies = BaseCookie.get();

            Object.entries(cookies).forEach((entry) => {
                const [cookieName, cookieValue] = entry;

                this.snowboard.globalEvent('cookie.get', cookieName, cookieValue, (newValue: string) => {
                    cookies[cookieName] = newValue;
                });
            });

            return cookies;
        }

        let value = BaseCookie.get(name);

        // Allow plugins to override the gotten value
        this.snowboard.globalEvent('cookie.get', name, value, (newValue: string) => {
            value = newValue;
        });

        return value;
    }

    /**
     * Set a cookie by name.
     *
     * You can specify additional cookie parameters through the "options" parameter.
     */
    set(name: string, value: string, options?: Cookies.CookieAttributes): string | undefined {
        let saveValue = value;

        // Allow plugins to override the value to save
        this.snowboard.globalEvent('cookie.set', name, value, (newValue: string) => {
            saveValue = newValue;
        });

        return BaseCookie.set(name, saveValue, {
            ...this.getDefaults(),
            ...options,
        });
    }

    /**
     * Remove a cookie by name.
     *
     * You can specify the additional cookie parameters via the "options" parameter.
     */
    remove(name: string, options?: Cookies.CookieAttributes): void {
        BaseCookie.remove(name, {
            ...this.getDefaults(),
            ...options,
        });
    }
}
