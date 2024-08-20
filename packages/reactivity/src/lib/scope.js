/**
 * @typedef {import('../abstracts/ReactivePluginBase').default} ReactivePluginBase
 * @typedef {import('../abstracts/ReactiveSingleton').default} ReactiveSingleton
 */

/**
 * Get mappable properties.
 *
 * This method analyzes the current object and retrieves all properties and methods that will be
 * made available to the reactivity data store.
 *
 * This will ignore certain properties and methods that are either required by Snowboard or are
 * provided by the Reactivity package itself.
 *
 * The returned object will be keyed by the property or method name, and the value will be the
 * definition of the method or property.
 *
 * @this {ReactiveSingleton|ReactivePluginBase}
 * @return {Object.<string, {type: string, value: any}>}
 */
function getMappableProperties() {
    const mappable = {};
    const props = Object.getOwnPropertyDescriptors(this);
    const protoProps = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this));
    const ignore = [
        'snowboard',
        'baseConstruct',
        'constructor',
        'construct',
        'init',
        'destruct',
        'destructor',
        'destructed',
        'detach',
        'template',
        'mountTo',
        'components',
        '$app',
        '$nextTick',
        '$reactive',
        '$mount',
        '$el',
        '$parent',
        '$data',
        '$refs',
        '$context',
        '$block',
        '$components',
        ...Object.getOwnPropertyNames(Object.prototype),
    ];

    Object.entries(protoProps).forEach(([key, prop]) => {
        if (ignore.includes(key) || key.startsWith('reactivity')) {
            return;
        }

        if (typeof prop.value === 'function') {
            mappable[key] = {
                type: 'function',
                value: prop.value,
            };
        } else if (prop.get && typeof prop.get === 'function') {
            mappable[key] = {
                type: 'getter',
                value: prop.get,
            };
        } else {
            mappable[key] = {
                type: 'value',
                value: prop.value,
            };
        }
    });
    Object.entries(props).forEach(([key, prop]) => {
        if (ignore.includes(key) || key.startsWith('reactivity')) {
            return;
        }

        if (typeof prop.value === 'function') {
            mappable[key] = {
                type: 'function',
                value: prop.value,
            };
        } else if (prop.get && typeof prop.get === 'function') {
            mappable[key] = {
                type: 'getter',
                value: prop.get,
            };
        } else {
            mappable[key] = {
                type: 'value',
                value: prop.value,
            };
        }
    });

    return mappable;
}

/**
 * Create a reactivity data store.
 *
 * Taking the mappable properties, this converts them into an object that is then fed to Vue as the
 * data store for reactivity.
 *
 * @this {ReactiveSingleton|ReactivePluginBase}
 * @param {Object.<string, {type: string, value: any}>} mappable
 * @return {Object.<string, {type: string, value: PropertyDescriptor}>}
 */
function createReactiveStore(mappable) {
    const obj = {};

    Object.entries(mappable).forEach(([key, prop]) => {
        if (prop.type === 'function') {
            Object.defineProperty(obj, key, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: (...args) => this[key].call(this, ...args),
            });
        } else if (prop.type === 'getter') {
            Object.defineProperty(obj, key, {
                configurable: true,
                enumerable: false,
                get: prop.value,
            });
        } else if (prop.type === 'value') {
            Object.defineProperty(obj, key, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: prop.value,
            });
        }
    });

    return obj;
}

/**
 * Map reactive properties to the original object.
 *
 * Once the mappable properties have been converted into a reactive data store, this method will
 * map the properties back to the original object. This allows for the properties and methods to
 * be accessed directly from the plugin instance and will react accordingly.
 *
 * @this {ReactiveSingleton|ReactivePluginBase}
 * @param {Object.<string, {type: string, value: any}>} mappable
 * @return {void}
 */
function mapReactiveStore(mappable) {
    Object.entries(mappable).forEach(([key, prop]) => {
        if (prop.type === 'getter') {
            Object.defineProperty(
                this,
                key,
                Object.getOwnPropertyDescriptor(this.$data, key),
            );
        } else if (prop.type === 'value') {
            Object.defineProperty(this, key, {
                get() { return this.$data[key]; },
                set(value) { this.$data[key] = value; },
            });
        }
    });
}

function updateReactiveStore(mappable) {
    Object.entries(mappable).forEach(([key, prop]) => {
        if (prop.type === 'value') {
            this.$data[key] = prop.value;
        }
    });
}

export {
    getMappableProperties,
    createReactiveStore,
    mapReactiveStore,
    updateReactiveStore,
};
