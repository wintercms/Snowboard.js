import InnerProxyHandler from './InnerProxyHandler';
import type Snowboard from './Snowboard';
import PluginBase from '../abstracts/PluginBase';
import type PluginInterface from '../interfaces/PluginInterface';
import type PrototypedObject from '../interfaces/PrototypedObject';

/**
 * Plugin loader class.
 *
 * This is a provider (factory) class for a single plugin and provides the link between Snowboard
 * framework functionality and the underlying plugin instances. It also provides some basic mocking
 * of plugin methods for testing.
 *
 * @copyright 2021 Winter.
 * @author Ben Thomson <git@alfreido.com>
 */
export default class PluginLoader {
    /**
     * The name of the plugin being loaded by this loader.
     */
    #name: string = '';

    /**
     * Snowboard instance.
     */
    #snowboard: Snowboard;

    /**
     * Root instance of the plugin being loaded by this loader.
     */
    #instance: any;

    /**
     * All instances of this plugin that are currently active.
     */
    #instances: Set<PluginInterface & PrototypedObject> = new Set();

    /**
     * Singleton status object.
     */
    #singleton: { initialised: boolean } = { initialised: false };

    /**
     * Mocked functions.
     */
    #mocks: Map<string, Function> = new Map();

    /**
     * Original functions that have been mocked.
     */
    #originalFunctions: Map<string, Function> = new Map();

    /**
     * Constructor.
     *
     * Binds the Snowboard framework to the instance.
     */
    constructor(name: string, snowboard: Snowboard, instance: PluginBase) {
        this.#name = name;
        this.#snowboard = new Proxy(
            snowboard,
            InnerProxyHandler,
        );
        this.#instance = instance;

        // Freeze instance that has been inserted into this loader
        Object.freeze(this.#instance);

        // Prevent further extension of the singleton status object
        Object.seal(this.#singleton);

        // Freeze loader itself
        Object.freeze(PluginLoader.prototype);
        Object.freeze(this);
    }

    /**
     * Determines if the current plugin has a specific method available.
     *
     * Returns `false` if the current plugin is a callback function.
     */
    hasMethod(methodName: string): boolean {
        return (typeof this.#instance.prototype[methodName] === 'function');
    }

    /**
     * Calls a prototype method for a plugin. This should generally be used for "static" calls.
     */
    callMethod(method: string, ...parameters: any[]): any {
        return this.#instance.prototype[method](...parameters);
    }

    /**
     * Returns an instance of the current plugin.
     *
     * If this is a singleton, the single instance of the plugin will be returned.
     */
    getInstance(...parameters: any[]): PluginInterface {
        if (!this.dependenciesFulfilled()) {
            const unmet = this.getDependencies().filter(
                (item: string) => !this.#snowboard.getPluginNames().includes(item),
            );
            throw new Error(`The "${this.#name}" plugin requires the following plugins: ${unmet.join(', ')}`);
        }

        if (this.isSingleton()) {
            if (this.#instances.size === 0) {
                this.initialiseSingleton(...parameters);
            }

            const instance: PluginInterface & PrototypedObject = this.#instances.values().next().value;

            // Apply mocked methods to singleton instance
            if (this.#mocks.size > 0) {
                this.#originalFunctions.forEach((callback: Function, methodName: string) => {
                    instance.prototype[methodName] = callback;
                });
                this.#mocks.forEach((callback, methodName) => {
                    instance.prototype[methodName] = (...params: any[]) => callback(
                        instance,
                        ...params,
                    );
                });
            }

            return instance;
        }

        const newInstance: PluginInterface & PrototypedObject = new this.#instance(this.#snowboard, ...parameters);

        // Apply mocked methods to instance
        if (this.#mocks.size > 0) {
            this.#originalFunctions.forEach((callback: Function, methodName: string) => {
                newInstance.prototype[methodName] = callback;
            });
            this.#mocks.forEach((callback: Function, methodName: string) => {
                newInstance.prototype[methodName] = (...params: any[]) => callback(newInstance, ...params);
            });
        }

        newInstance.detach = () => this.#instances.delete(newInstance);
        newInstance.construct(...parameters);
        this.loadTraits(newInstance);
        newInstance.init();
        this.#instances.add(newInstance);

        return newInstance;
    }

    /**
     * Gets all instances of the current plugin.
     */
    getInstances(): Set<PluginInterface & PrototypedObject> {
        return this.#instances;
    }

    /**
     * Determines if the current plugin is a singleton.
     */
    isSingleton(): boolean {
        return this.#instance.prototype.isSingleton() === true;
    }

    /**
     * Determines if a singleton has been initialised.
     *
     * Normal plugins will always return true.
     */
    isInitialised(): boolean {
        if (!this.isSingleton()) {
            return true;
        }

        return this.#singleton.initialised;
    }

    /**
     * Initialises the singleton instance.
     */
    initialiseSingleton(...parameters: any[]): void {
        if (!this.isSingleton()) {
            return;
        }

        const newInstance = new this.#instance(this.#snowboard, ...parameters);
        newInstance.detach = () => this.#instances.delete(newInstance);
        newInstance.construct(...parameters);
        this.loadTraits(newInstance);
        newInstance.init();
        this.#instances.add(newInstance);

        this.#singleton.initialised = true;
    }

    /**
     * Gets the dependencies of the current plugin.
     */
    getDependencies(): string[] {
        return this.#instance.prototype.dependencies().map((item: string) => item.toLowerCase());
    }

    /**
     * Determines if the current plugin has all its dependencies fulfilled.
     */
    dependenciesFulfilled(): boolean {
        const dependencies = this.getDependencies();

        let fulfilled = true;
        dependencies.forEach((plugin) => {
            if (!this.#snowboard.hasPlugin(plugin)) {
                fulfilled = false;
            }
        });

        return fulfilled;
    }

    /**
     * Allows a method of an instance to be mocked for testing.
     *
     * This mock will be applied for the life of an instance. For singletons, the mock will be
     * applied immediately. For normal plugins, the mock will be applied on any instances created
     * after the mock is applied.
     */
    mock(methodName: string, callback: Function): void {
        if (!this.#instance.prototype[methodName]) {
            throw new Error(`Function "${methodName}" does not exist and cannot be mocked`);
        }

        this.#mocks.set(methodName, callback);
        this.#originalFunctions.set(methodName, Object.getPrototypeOf(this.#instance)[methodName]);

        if (this.isSingleton() && this.#instances.size === 0) {
            this.initialiseSingleton();

            const instance: PluginInterface & PrototypedObject = this.#instances.values().next().value;

            // Apply mocked method
            instance.prototype[methodName] = (...parameters: any) => callback(this, ...parameters);
        }
    }

    /**
     * Removes a mock callback from future instances.
     */
    unmock(methodName: string): void {
        if (!this.#mocks.has(methodName)) {
            return;
        }

        if (this.isSingleton()) {
            const instance: PluginInterface & PrototypedObject = this.#instances.values().next().value;

            instance.prototype[methodName] = this.#originalFunctions.get(methodName);
        }

        this.#mocks.delete(methodName);
        this.#originalFunctions.delete(methodName);
    }

    /**
     * Attaches traits (mixins) to the given instance.
     *
     * Traits form code reuse within Snowboard plugin classes. A trait will populate its own
     * methods and properties into the instance. If this instance overwrites a trait method or
     * property, the instance's method or property will be used instead.
     *
     * This implementation of traits will also go up the hierarchy of prototypes to inherit all
     * traits from parent classes, making it operate similar to PHP traits.
     *
     * Differences from PHP traits:
     *   - Traits are classes in JavaScript.
     *   - Locally defined traits do *not* overwrite methods from parent classes.
     *   - Two or more traits can have the same method name - precedence is first-come-first-serve,
     *     (ie. the first trait that provides the method will be used), since aliasing does not
     *     exist.
     */
    loadTraits(instance: PluginInterface & PrototypedObject): void {
        const traits: Set<string> = new Set();
        let currentPrototype = instance;

        while (currentPrototype.constructor.name !== 'Object') {
            if (
                currentPrototype.traits
                && typeof currentPrototype.traits === 'function'
            ) {
                const currentTraits = currentPrototype.traits();

                currentTraits.forEach((trait: string) => {
                    traits.add(trait);
                });
            }

            currentPrototype = currentPrototype.prototype;
        }

        // Apply traits (inspired by https://calebporzio.com/equivalent-of-php-class-traits-in-javascript)
        traits.forEach((trait) => {
            if (this.#snowboard.hasTrait(trait) === false) {
                this.#snowboard.warning(`Trait "${trait}" does not exist and cannot be applied to "${this.#name}"`);
                return;
            }

            const TraitInstance: any = this.#snowboard.getTrait(trait);
            const traitInstance = new TraitInstance();

            // Get defined properties in trait constructor.
            const descriptors = Object.keys(traitInstance).reduce((innerDescriptors: { [key: string]: any }, key: string) => {
                innerDescriptors[key] = Object.getOwnPropertyDescriptor(traitInstance, key);
                return innerDescriptors;
            }, {});

            // Get methods defined in trait prototype.
            Object.getOwnPropertyNames(TraitInstance).forEach((propertyName) => {
                if ([
                    'constructor',
                    'construct',
                    'init',
                    'getSnowboard',
                    'destruct',
                    'destructor',
                    'detach'
                ].includes(propertyName)) {
                    return;
                }

                const descriptor = Object.getOwnPropertyDescriptor(
                    Object.getPrototypeOf(TraitInstance),
                    propertyName,
                );
                descriptors[propertyName] = descriptor;
            });

            // Filter out any of the above that already exist in the instance.
            const newDescriptors = Object.keys(descriptors)
                .filter((key: string) => Object.getPrototypeOf(instance)[key] === undefined)
                .reduce((filtered: { [key: string]: any }, key: string) => {
                    filtered[key] = descriptors[key];
                    return filtered;
                }, {});

            // Apply new descriptors to instance.
            Object.defineProperties(instance, newDescriptors);

            // If the trait has a "construct" method, apply this to the instance.
            if (traitInstance.construct) {
                traitInstance.construct.call(instance);
            }
        });
    }
}
