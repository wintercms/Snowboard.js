import ProxyHandler from './ProxyHandler';
import PluginBase from '../abstracts/PluginBase';
import Singleton from '../abstracts/Singleton';
import PluginLoader from './PluginLoader';

import Configurable from '../traits/Configurable';
import FiresEvents from '../traits/FiresEvents';
import AssetLoader from '../utilities/AssetLoader';
import Cookie from '../utilities/Cookie';
import JsonParser from '../utilities/JsonParser';
import Sanitizer from '../utilities/Sanitizer';
import Url from '../utilities/Url';
import type TraitInterface from '../interfaces/TraitInterface';

/**
 * Snowboard.js framework.
 *
 * Originally designed for [Winter CMS](https://wintercms.com), this framework represents the base
 * of a modern take on Javascript functionality management, with a focus on extensibility and
 * reusability without putting any restrictions on UI, and sharing many common practices with PHP
 * development.
 *
 * This version of the framework has been written as a standalone framework, untied to Winter CMS,
 * and can therefore be used in any web-based project.
 *
 * @copyright 2021 Winter.
 * @author Ben Thomson <git@alfreido.com>
 * @link https://wintercms.com/docs/snowboard/introduction
 */
export default class Snowboard {
    /**
     * Whether debugging logs should be shown.
     */
    debugEnabled: boolean = false;

    /**
     * Registered plugins.
     */
    private plugins: Map<string, PluginLoader> = new Map();

    /**
     * Registered abstracts.
     */
    private abstracts: Map<string, object> = new Map();

    /**
     * Registered traits.
     */
    private traits: Map<string, TraitInterface> = new Map();

    /**
     * Listeners, keyed by event name.
     */
    private listeners: Map<string, Function[]> = new Map();

    /**
     * Readiness tracking for the framework.
     */
    private readiness: { dom: boolean } = { dom: false };

    /**
     * Constructor.
     *
     * @param {boolean} debug Whether debugging logs should be shown. Default: `false`.
     */
    constructor(debug: boolean = false) {
        /**
         * Whether debugging logs should be shown.
         * @type {boolean}
         */
        this.debugEnabled = debug;

        this.attachAbstracts();

        // Freeze the Snowboard class to prevent further modifications.
        Object.freeze(Snowboard.prototype);
        Object.freeze(this);

        this.loadInbuilt();
        this.initialise();

        this.debug('Snowboard framework initialised');

        /* eslint-disable no-constructor-return */
        return new Proxy(this, ProxyHandler);
    }

    /**
     * Attaches abstract classes as properties of the Snowboard class.
     *
     * This will allow Javascript functionality with no build process to still extend these
     * abstracts by prefixing them with "Snowboard".
     *
     * For example:
     *
     * ```
     * class MyClass extends Snowboard.PluginBase {
     *     ...
     * }
     * ```
     */
    private attachAbstracts(): void {
        this.addAbstract('PluginBase', PluginBase);
        this.addAbstract('Singleton', Singleton);
    }

    /**
     * Adds an abstract.
     *
     * Abstracts are simply classes that can be extended upon by other plugins. They are registered
     * under the Snowboard namespace to function for users without a build process or using the
     * global Snowboard variable. Abstracts *must* extend the `PluginBase` abstract class in order
     * to correctly function with the plugin loader.
     *
     * Abstracts will be frozen upon being added - this will prevent any further modification to the
     * base classes. Abstracts also cannot be removed once added.
     *
     * Please note that, unlike plugins, abstracts are case-sensitive.
     */
    addAbstract(name: string, instance: object): void {
        if (this.hasPlugin(name) || this.hasAbstract(name)) {
            throw new Error(`A plugin or abstract called "${name}" is already registered.`);
        }

        if (
            (instance !== PluginBase)
            && !this.isPluginBase(instance)
        ) {
            throw new Error('The provided abstract must extend the PluginBase class');
        }

        if (Reflect.ownKeys(this).includes(name)) {
            throw new Error('The given name is already in use for a property or method of the Snowboard class.');
        }

        Object.freeze(instance);
        this.abstracts.set(name, instance);
    }

    /**
     * Determines if an abstract of the given name is available.
     */
    hasAbstract(name: string): boolean {
        return this.abstracts.has(name);
    }

    /**
     * Loads the default traits and utilities.
     */
    private loadInbuilt(): void {
        this.registerTrait('configurable', Configurable.prototype);
        this.registerTrait('firesEvents', FiresEvents.prototype);
        this.addPlugin('assetLoader', AssetLoader.prototype);
        this.addPlugin('cookie', Cookie.prototype);
        this.addPlugin('jsonParser', JsonParser.prototype);
        this.addPlugin('sanitizer', Sanitizer.prototype);
        this.addPlugin('url', Url.prototype);
    }

    /**
     * Initialises the framework.
     *
     * Attaches a listener for the DOM being ready and triggers a global "ready" event for plugins
     * to begin attaching themselves to the DOM.
     *
     * If no window is found, the framework is considered ready immediately.
     */
    private initialise(): void {
        const ready = () => {
            this.initialiseSingletons();
            this.globalEvent('ready');
            this.readiness.dom = true;
        };

        if (!window) {
            ready();
        }

        window.addEventListener('DOMContentLoaded', ready);
    }

    /**
     * Tears down an entire Snowboard instance.
     *
     * While this is mainly used for tests, it may be useful in cases where you want to completely
     * destruct all plugins and tear down the app into a clean slate.
     *
     * This will also remove all registered plugins, abstracts, and traits.
     */
    tearDown(): void {
        this.plugins.forEach((plugin, name) => {
            plugin.getInstances().forEach((instance) => {
                instance.destructor();
            });
            this.plugins.delete(name);
        });

        this.abstracts.clear();
        this.traits.clear();
        this.listeners.clear();
    }

    /**
     * Initialises an instance of every singleton.
     *
     * @return {void}
     */
    private initialiseSingletons() {
        this.plugins.forEach((plugin) => {
            if (plugin.isSingleton() && plugin.dependenciesFulfilled()) {
                plugin.initialiseSingleton();
            }
        });
    }

    /**
     * Adds a plugin to the framework.
     *
     * Plugins are the cornerstone for additional functionality for Snowboard. A plugin must either
     * be an ES2015 class that extends the `PluginBase` or `Singleton` abstract classes, or a simple
     * callback function.
     *
     * When a plugin is added, it is automatically assigned as a new magic method in the Snowboard
     * class using the name parameter, and can be called via this method. This method will always be
     * the "lowercase" version of this name.
     *
     * For example, if a plugin is assigned to the name "myPlugin", it can be called via
     * `Snowboard.myplugin()`.
     */
    addPlugin(name: string, instance: PluginBase): void {
        if (this.hasPlugin(name) || this.hasAbstract(name)) {
            throw new Error(`A plugin or abstract called "${name}" is already registered.`);
        }

        if (!this.isPluginBase(instance)) {
            throw new Error('The provided plugin must extend the PluginBase class');
        }

        const lowerName = name.toLowerCase();

        if (Object.getPrototypeOf(this)[name] !== undefined || Object.getPrototypeOf(this)[lowerName] !== undefined) {
            throw new Error('The given name is already in use for a property or method of the Snowboard class.');
        }

        this.plugins.set(lowerName, new PluginLoader(lowerName, this, instance));

        this.debug(`Plugin "${name}" registered`);

        // Check if any singletons now have their dependencies fulfilled, and fire their "ready"
        // handler if we're in a ready state.
        Object.values(this.getPlugins()).forEach((plugin: PluginLoader) => {
            if (
                plugin.isSingleton()
                && !plugin.isInitialised()
                && plugin.dependenciesFulfilled()
                && plugin.hasMethod('listens')
                && Object.keys(plugin.callMethod('listens')).includes('ready')
                && this.readiness.dom
            ) {
                const readyMethod = plugin.callMethod('listens').ready;
                plugin.callMethod(readyMethod);
            }
        });
    }

    /**
     * Removes a plugin.
     *
     * Removes a plugin from Snowboard, calling the destructor method for all active instances of
     * the plugin.
     *
     * @param {string} name
     * @return {void}
     */
    removePlugin(name: string): void {
        if (!this.hasPlugin(name)) {
            this.debug(`Plugin "${name}" doesn't exist or is already removed`);
            return;
        }

        const lowerName = name.toLowerCase();

        // Call destructors for all instances
        this.plugins.get(lowerName)?.getInstances().forEach((instance) => {
            instance.destructor();
        });

        this.plugins.delete(lowerName);

        this.debug(`Plugin "${name}" removed`);
    }

    /**
     * Determines if a plugin has been registered and is active.
     *
     * A plugin that is still waiting for dependencies to be registered will not be active.
     */
    hasPlugin(name: string): boolean {
        const lowerName = name.toLowerCase();

        return this.plugins.has(lowerName);
    }

    /**
     * Returns an array of registered plugins as PluginLoader objects.
     */
    getPlugins(): Map<string, PluginLoader> {
        return this.plugins;
    }

    /**
     * Returns an array of registered plugins, by name.
     */
    getPluginNames(): string[] {
        return Array.from(this.plugins.keys());
    }

    /**
     * Returns a PluginLoader object of a given plugin.
     */
    getPlugin(name: string): PluginLoader {
        if (!this.plugins.has(name)) {
            throw new Error(`No plugin called "${name}" has been registered.`);
        }

        return this.plugins.get(name.toLowerCase())!;
    }

    /**
     * Determines if the instance provided uses the plugin base.
     *
     * This is a simple API check because some build processes muck up the prototype chain and
     * prevent the usage of "instanceof" to check against the `PluginBase` class.
     */
    isPluginBase(instance: any): boolean {
        const methods = new Set();

        Reflect.ownKeys(instance).forEach((key) => {
            if (typeof instance[key] !== 'function') {
                return;
            }

            methods.add(key);
        });

        while (Reflect.getPrototypeOf(instance)) {
            instance = Reflect.getPrototypeOf(instance);
            Reflect.ownKeys(instance).forEach((key) => {
                if (typeof instance[key] !== 'function') {
                    return;
                }

                methods.add(key);
            });
        }

        if (
            methods.has('construct')
            && methods.has('getSnowboard')
            && methods.has('isSingleton')
            && methods.has('init')
            && methods.has('dependencies')
            && methods.has('listens')
            && methods.has('destruct')
            && methods.has('destructor')
        ) {
            return true;
        }

        return false;
    }

    /**
     * Registers a trait with the framework.
     *
     * Traits are reusable classes that are merged into plugins that implement them. Upon
     * initialization of a plugin or singleton instance, after the instance is constructed, all
     * traits that are to be used will also be constructed, and their methods and properties will
     * be merged into the plugin instance.
     */
    registerTrait(name: string, instance: TraitInterface): void {
        if (this.hasTrait(name)) {
            throw new Error(`A trait called "${name}" is already registered.`);
        }

        const lowerName = name.toLowerCase();

        if (Object.getPrototypeOf(this)[name] !== undefined || Object.getPrototypeOf(this)[lowerName] !== undefined) {
            throw new Error('The given name is already in use for a property or method of the Snowboard class.');
        }

        this.traits.set(lowerName, instance);

        this.debug(`Trait "${name}" registered`);
    }

    /**
     * Determines if a trait has been registered.
     */
    hasTrait(name: string): boolean {
        const lowerName = name.toLowerCase();

        return this.traits.has(lowerName);
    }

    /**
     * Returns an array of registered traits as individual class objects.
     */
    getTraits(): Map<string, object> {
        return this.traits;
    }

    /**
     * Returns the prototype of the given trait.
     */
    getTrait(name: string): TraitInterface {
        if (!this.hasTrait(name)) {
            throw new Error(`No trait called "${name}" has been registered.`);
        }

        const lowerName = name.toLowerCase();

        return this.traits.get(lowerName)!;
    }

    /**
     * Finds all plugins that listen to the given event.
     *
     * This works for both normal and promise events. It does *not* check that the plugin's listener
     * actually exists.
     *
     * @return {string[]} The name of the plugins that are listening to this event.
     */
    listensToEvent(eventName: string): string[] {
        const plugins: string[] = [];

        this.plugins.forEach((plugin, name) => {
            if (!plugin.dependenciesFulfilled()) {
                return;
            }

            const listeners = plugin.callMethod('listens');

            if (typeof listeners[eventName] === 'string' || typeof listeners[eventName] === 'function') {
                plugins.push(name);
            }
        });

        return plugins;
    }

    /**
     * Add a simple ready listener.
     *
     * Synonymous with jQuery's "$(document).ready()" functionality, this allows inline scripts to
     * attach themselves to Snowboard immediately but only fire when the DOM is ready.
     */
    ready(callback: Function): void {
        if (this.readiness.dom) {
            callback();
        }

        this.on('ready', callback);
    }

    /**
     * Adds a simple listener for an event.
     *
     * This can be used for ad-hoc scripts that don't need a full plugin. The given callback will be
     * called when the event name provided fires. This works for both normal and Promise events. For
     * a Promise event, your callback must return a Promise.
     */
    on(eventName: string, callback: Function): void {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        if (!this.listeners.get(eventName)!.includes(callback)) {
            this.listeners.get(eventName)!.push(callback);
        }
    }

    /**
     * Removes a simple listener for an event.
     */
    off(eventName: string, callback: Function): void {
        if (!this.listeners.has(eventName)) {
            return;
        }

        const index = this.listeners.get(eventName)!.indexOf(callback);
        if (index === -1) {
            return;
        }

        this.listeners.get(eventName)!.splice(index, 1);
    }

    /**
     * Calls a global event to all registered plugins.
     *
     * If any plugin returns a `false`, the event is considered cancelled.
     *
     * @return {boolean} If event was not cancelled
     */
    globalEvent(eventName: string, ...parameters: any[]): boolean {
        this.debug(`Calling global event "${eventName}"`, ...parameters);

        let cancelled = false;

        // Find plugins listening to the event.
        const listeners = this.listensToEvent(eventName);
        if (listeners.length === 0) {
            this.debug(`No listeners found for global event "${eventName}"`);
        } else {
            this.debug(`Listeners found for global event "${eventName}": ${listeners.join(', ')}`);

            listeners.forEach((name) => {
                const plugin = this.getPlugin(name);

                if (plugin.isSingleton() && plugin.getInstances().size === 0) {
                    plugin.initialiseSingleton();
                }

                const listenMethod = plugin.callMethod('listens')[eventName];

                // Call event handler methods for all plugins, if they have a method specified for
                // the event.
                plugin.getInstances().forEach((instance) => {
                    // If a plugin has cancelled the event, no further plugins are considered.
                    if (cancelled) {
                        return;
                    }

                    if (typeof listenMethod === 'function') {
                        try {
                            const result = listenMethod.apply(instance, parameters);
                            if (result === false) {
                                cancelled = true;
                            }
                        } catch (error) {
                            this.error(
                                `Error thrown in "${eventName}" event by "${name}" plugin.`,
                                error,
                            );
                        }
                    } else if (typeof listenMethod === 'string') {
                        if (!instance.prototype[listenMethod]) {
                            throw new Error(`Missing "${listenMethod}" method in "${name}" plugin`);
                        }

                        try {
                            if (instance.prototype[listenMethod](...parameters) === false) {
                                cancelled = true;
                                this.debug(`Global event "${eventName}" cancelled by "${name}" plugin`);
                            }
                        } catch (error) {
                            this.error(
                                `Error thrown in "${eventName}" event by "${name}" plugin.`,
                                error,
                            );
                        }
                    } else {
                        this.error(`Listen method for "${eventName}" event in "${name}" plugin is not a function or string.`);
                    }
                });
            });
        }

        // Find ad-hoc listeners for this event.
        if (
            !cancelled
            && this.listeners.has(eventName)
            && this.listeners.get(eventName)!.length > 0
        ) {
            this.debug(`Found ${this.listeners.get(eventName)!.length} ad-hoc listener(s) for global event "${eventName}"`);

            this.listeners.get(eventName)!.forEach((listener) => {
                // If a listener has cancelled the event, no further listeners are considered.
                if (cancelled) {
                    return;
                }

                try {
                    if (listener(...parameters) === false) {
                        cancelled = true;
                        this.debug(`Global event "${eventName} cancelled by an ad-hoc listener.`);
                    }
                } catch (error) {
                    this.error(
                        `Error thrown in "${eventName}" event by an ad-hoc listener.`,
                        error,
                    );
                }
            });
        }

        return !cancelled;
    }

    /**
     * Calls a global event to all registered plugins, expecting a Promise to be returned by all.
     *
     * This collates all plugins responses into one large Promise that either expects all to be
     * resolved, or one to reject.
     *
     * If no listeners are found, a resolved Promise is returned.
     */
    globalPromiseEvent(eventName: string, ...parameters: any[]): Promise<any[]> {
        this.debug(`Calling global promise event "${eventName}"`);

        const promises: Promise<any>[] = [];

        // Find plugins listening to this event.
        const listeners = this.listensToEvent(eventName);
        if (listeners.length === 0) {
            this.debug(`No listeners found for global promise event "${eventName}"`);
        } else {
            this.debug(`Listeners found for global promise event "${eventName}": ${listeners.join(', ')}`);

            listeners.forEach((name) => {
                const plugin = this.getPlugin(name);

                if (plugin.isSingleton() && plugin.getInstances().size === 0) {
                    plugin.initialiseSingleton();
                }

                const listenMethod = plugin.callMethod('listens')[eventName];

                // Call event handler methods for all plugins, if they have a method specified for
                // the event.
                plugin.getInstances().forEach((instance) => {
                    if (typeof listenMethod === 'function') {
                        try {
                            const instancePromise = listenMethod.apply(instance, parameters);

                            if (instancePromise instanceof Promise === false) {
                                return;
                            }

                            promises.push(instancePromise);
                        } catch (error) {
                            this.error(
                                `Error thrown in "${eventName}" event by "${name}" plugin.`,
                                error,
                            );
                        }
                    } else if (typeof listenMethod === 'string') {
                        if (!instance[listenMethod]) {
                            throw new Error(`Missing "${listenMethod}" method in "${name}" plugin`);
                        }

                        try {
                            const instancePromise = instance[listenMethod](...parameters);

                            if (instancePromise instanceof Promise === false) {
                                return;
                            }

                            promises.push(instancePromise);
                        } catch (error) {
                            this.error(
                                `Error thrown in "${eventName}" promise event by "${name}" plugin.`,
                                error,
                            );
                        }
                    } else {
                        this.error(`Listen method for "${eventName}" event in "${name}" plugin is not a function or string.`);
                    }
                });
            });
        }

        // Find ad-hoc listeners listening to this event.
        if (
            this.listeners.has(eventName)
            && this.listeners.get(eventName)!.length > 0
        ) {
            this.debug(`Found ${this.listeners.get(eventName)!.length} ad-hoc listener(s) for global promise event "${eventName}"`);

            this.listeners.get(eventName)!.forEach((listener) => {
                try {
                    const listenerPromise = listener(...parameters);
                    if (listenerPromise instanceof Promise === false) {
                        return;
                    }

                    promises.push(listenerPromise);
                } catch (error) {
                    this.error(
                        `Error thrown in "${eventName}" promise event by an ad-hoc listener.`,
                        error,
                    );
                }
            });
        }

        if (promises.length === 0) {
            return Promise.resolve([]);
        }

        return Promise.all(promises);
    }

    /**
     * Log a styled message in the console.
     *
     * Includes parameters and a stack trace.
     */
    private logMessage(color: string, bold: boolean = false, message: string = '', ...parameters: any[]): void {
        /* eslint-disable */
        console.groupCollapsed(
            '%c[Snowboard]',
            `color: ${color}; font-weight: ${(bold) ? 'bold' : 'normal'};`,
            message
        );
        if (parameters.length) {
            console.groupCollapsed(
                `%cParameters %c(${parameters.length})`,
                'color: rgb(45, 167, 199); font-weight: bold;',
                'color: rgb(88, 88, 88); font-weight: normal;'
            );
            let index = 0;
            parameters.forEach((param) => {
                index += 1;
                console.log(`%c${index}:`, 'color: rgb(88, 88, 88); font-weight: normal;', param);
            });
            console.groupEnd();

            console.groupCollapsed('%cTrace', 'color: rgb(45, 167, 199); font-weight: bold;');
            console.trace();
            console.groupEnd();
        } else {
            console.trace();
        }
        console.groupEnd();
        /* eslint-enable */
    }

    /**
     * Log a message.
     */
    log(message: string, ...parameters: any[]): void {
        this.logMessage('rgb(45, 167, 199)', false, message, ...parameters);
    }

    /**
     * Log a debug message.
     *
     * These messages are only shown when debugging is enabled.
     */
    debug(message: string, ...parameters: any[]): void {
        if (!this.debugEnabled) {
            return;
        }

        this.logMessage('rgb(45, 167, 199)', false, message, ...parameters);
    }

    /**
     * Log a warning message.
     *
     * These messages are only shown when debugging is enabled.
     */
    warning(message: string, ...parameters: any[]): void {
        if (!this.debugEnabled) {
            return;
        }

        this.logMessage('rgb(229, 179, 71)', true, message, ...parameters);
    }

    /**
     * Logs an error message.
     */
    error(message: string, ...parameters: any[]): void {
        this.logMessage('rgb(211, 71, 71)', true, message, ...parameters);
    }
}
