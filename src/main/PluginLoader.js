import Singleton from '../abstracts/Singleton';
import InnerProxyHandler from './InnerProxyHandler';

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
     * Constructor.
     *
     * Binds the Winter framework to the instance.
     *
     * @param {string} name
     * @param {Snowboard} snowboard
     * @param {PluginBase} instance
     */
    constructor(name, snowboard, instance) {
        this.name = name;
        this.snowboard = new Proxy(
            snowboard,
            InnerProxyHandler,
        );
        this.instance = instance;

        // Freeze instance that has been inserted into this loader
        Object.freeze(this.instance);

        this.instances = [];
        this.singleton = {
            initialised: false,
        };
        // Prevent further extension of the singleton status object
        Object.seal(this.singleton);

        this.mocks = {};
        this.originalFunctions = {};

        // Freeze loader itself
        Object.freeze(PluginLoader.prototype);
        Object.freeze(this);
    }

    /**
     * Determines if the current plugin has a specific method available.
     *
     * Returns false if the current plugin is a callback function.
     *
     * @param {string} methodName
     * @returns {boolean}
     */
    hasMethod(methodName) {
        return (typeof this.instance.prototype[methodName] === 'function');
    }

    /**
     * Calls a prototype method for a plugin. This should generally be used for "static" calls.
     *
     * @param {string} methodName
     * @param {...} args
     * @returns {any}
     */
    callMethod(...parameters) {
        const args = parameters;
        const methodName = args.shift();

        return this.instance.prototype[methodName](args);
    }

    /**
     * Returns an instance of the current plugin.
     *
     * - If this is a callback function plugin, the function will be returned.
     * - If this is a singleton, the single instance of the plugin will be returned.
     *
     * @returns {PluginBase|Function}
     */
    getInstance(...parameters) {
        if (!this.dependenciesFulfilled()) {
            const unmet = this.getDependencies().filter(
                (item) => !this.snowboard.getPluginNames().includes(item),
            );
            throw new Error(`The "${this.name}" plugin requires the following plugins: ${unmet.join(', ')}`);
        }
        if (this.isSingleton()) {
            if (this.instances.length === 0) {
                this.initialiseSingleton(...parameters);
            }

            // Apply mocked methods
            if (Object.keys(this.mocks).length > 0) {
                Object.entries(this.originalFunctions).forEach((entry) => {
                    const [methodName, callback] = entry;
                    this.instances[0][methodName] = callback;
                });
                Object.entries(this.mocks).forEach((entry) => {
                    const [methodName, callback] = entry;
                    this.instances[0][methodName] = (...params) => callback(this, ...params);
                });
            }

            return this.instances[0];
        }

        // Apply mocked methods to prototype
        if (Object.keys(this.mocks).length > 0) {
            Object.entries(this.originalFunctions).forEach((entry) => {
                const [methodName, callback] = entry;
                this.instance.prototype[methodName] = callback;
            });
            Object.entries(this.mocks).forEach((entry) => {
                const [methodName, callback] = entry;
                this.instance.prototype[methodName] = (...params) => callback(this, ...params);
            });
        }

        const newInstance = new this.instance(this.snowboard, ...parameters);
        newInstance.detach = () => this.instances.splice(this.instances.indexOf(newInstance), 1);
        newInstance.construct(...parameters);
        this.loadTraits(newInstance);
        this.instances.push(newInstance);

        return newInstance;
    }

    /**
     * Gets all instances of the current plugin.
     *
     * If this plugin is a callback function plugin, an empty array will be returned.
     *
     * @returns {PluginBase[]}
     */
    getInstances() {
        return this.instances;
    }

    /**
     * Determines if the current plugin is a singleton.
     *
     * @returns {boolean}
     */
    isSingleton() {
        return this.instance.prototype instanceof Singleton === true;
    }

    /**
     * Determines if a singleton has been initialised.
     *
     * Normal plugins will always return true.
     *
     * @returns {boolean}
     */
    isInitialised() {
        if (!this.isSingleton()) {
            return true;
        }

        return this.singleton.initialised;
    }

    /**
     * Initialises the singleton instance.
     *
     * @returns {void}
     */
    initialiseSingleton(...parameters) {
        if (!this.isSingleton()) {
            return;
        }

        const newInstance = new this.instance(this.snowboard, ...parameters);
        newInstance.detach = () => this.instances.splice(this.instances.indexOf(newInstance), 1);
        newInstance.construct(...parameters);
        this.loadTraits(newInstance);
        this.instances.push(newInstance);

        this.singleton.initialised = true;
    }

    /**
     * Gets the dependencies of the current plugin.
     *
     * @returns {string[]}
     */
    getDependencies() {
        return this.instance.prototype.dependencies().map((item) => item.toLowerCase());
    }

    /**
     * Determines if the current plugin has all its dependencies fulfilled.
     *
     * @returns {boolean}
     */
    dependenciesFulfilled() {
        const dependencies = this.getDependencies();

        let fulfilled = true;
        dependencies.forEach((plugin) => {
            if (!this.snowboard.hasPlugin(plugin)) {
                fulfilled = false;
            }
        });

        return fulfilled;
    }

    /**
     * Allows a method of an instance to be mocked for testing.
     *
     * This mock will be applied for the life of an instance. For singletons, the mock will be
     * applied for the life of the page.
     *
     * Mocks cannot be applied to callback function plugins.
     *
     * @param {string} methodName
     * @param {Function} callback
     */
    mock(methodName, callback) {
        if (!this.instance.prototype[methodName]) {
            throw new Error(`Function "${methodName}" does not exist and cannot be mocked`);
        }

        this.mocks[methodName] = callback;
        this.originalFunctions[methodName] = this.instance.prototype[methodName];

        if (this.isSingleton() && this.instances.length === 0) {
            this.initialiseSingleton();

            // Apply mocked method
            this.instances[0][methodName] = (...parameters) => callback(this, ...parameters);
        }
    }

    /**
     * Removes a mock callback from future instances.
     *
     * @param {string} methodName
     */
    unmock(methodName) {
        if (!this.mocks[methodName]) {
            return;
        }

        if (this.isSingleton()) {
            this.instances[0][methodName] = this.originalFunctions[methodName];
        }

        delete this.mocks[methodName];
        delete this.originalFunctions[methodName];
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
     *
     * @param {PluginBase} instance
     * @returns {void}
     */
    loadTraits(instance) {
        const traits = [];
        let currentPrototype = instance;

        while (currentPrototype.constructor.name !== 'Object') {
            if (
                currentPrototype.traits
                && typeof currentPrototype.traits === 'function'
            ) {
                const currentTraits = currentPrototype.traits();

                if (Array.isArray(currentTraits)) {
                    currentTraits.forEach((trait) => {
                        if (traits.includes(trait)) {
                            return;
                        }

                        traits.push({
                            trait,
                            config: {},
                        });
                    });
                } else if (typeof currentTraits === 'object') {
                    Object.entries(currentTraits).forEach(([trait, config]) => {
                        if (traits.includes(trait)) {
                            return;
                        }

                        traits.push({
                            trait,
                            config,
                        });
                    });
                }
            }

            currentPrototype = Object.getPrototypeOf(currentPrototype);
        }

        // Apply traits (inspired by https://calebporzio.com/equivalent-of-php-class-traits-in-javascript)
        traits.forEach((trait) => {
            if (this.snowboard.hasTrait(trait.trait) === false) {
                this.warning(`Trait "${trait.trait}" does not exist and cannot be applied to "${this.name}"`);
                return;
            }

            const TraitInstance = this.snowboard.getTrait(trait.trait);
            const traitInstance = new TraitInstance();

            // Get defined properties in trait constructor.
            const descriptors = Object.keys(traitInstance).reduce((innerDescriptors, key) => {
                innerDescriptors[key] = Object.getOwnPropertyDescriptor(traitInstance, key);
                return innerDescriptors;
            }, {});

            // Get methods defined in trait prototype.
            Object.getOwnPropertyNames(TraitInstance.prototype).forEach((propertyName) => {
                if (['constructor', 'construct', 'destruct', 'destructor'].includes(propertyName)) {
                    return;
                }

                const descriptor = Object.getOwnPropertyDescriptor(
                    TraitInstance.prototype,
                    propertyName,
                );
                descriptors[propertyName] = descriptor;
            });

            // Filter out any of the above that already exist in the instance.
            const newDescriptors = Object.keys(descriptors)
                .filter((key) => instance[key] === undefined)
                .reduce((filtered, key) => {
                    filtered[key] = descriptors[key];
                    return filtered;
                }, {});

            // Apply new descriptors to instance.
            Object.defineProperties(instance, newDescriptors);

            // If the trait has a "construct" method, apply this to the instance.
            if (traitInstance.construct) {
                traitInstance.construct.call(instance, trait.config);
            }
        });
    }
}
