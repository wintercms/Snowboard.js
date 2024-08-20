import type Snowboard from '../main/Snowboard';
import type TraitInterface from './TraitInterface';

/**
 * Plugin interface.
 *
 * Represents the expected makeup of a plugin in Snowboard, and used for type-hinting.
 */
export default interface PluginInterface {
    /**
     * Snowboard instance.
     */
    snowboard: Snowboard;

    /**
     * Is this plugin instance destructed?
     */
    destructed: boolean;

    /**
     * Gets the Snowboard instance that this plugin is attached to.
     */
    getSnowboard(): Snowboard;

    /**
     * Determines if this plugin is a singleton.
     */
    isSingleton(): boolean;

    /**
     * Plugin constructor.
     *
     * This method should be treated as the true constructor of a plugin, and can be overwritten.
     * It will be called straight after construction, but before traits are loaded, allowing you
     * to define any required properties needed for the traits.
     */
    construct(...parameters: any[]): void;

    /**
     * Plugin initializer.
     *
     * This method is call after construction is complete and after traits are loaded. It can be
     * used to run any functionality that you want available immediately after the plugin instance
     * is ready to use.
     */
    init(): void;

    /**
     * Defines the required plugins for this specific module to work.
     *
     * @returns {string[]} An array of plugins required for this module to work, as strings.
     */
    dependencies(): string[];

    /**
     * Defines the traits for this plugin.
     */
    traits(): string[];

    /**
     * Defines the listener methods for global events.
     */
    listens(): { [key: string]: string | Function };

    /**
     * Plugin destructor.
     *
     * Fired when this plugin is removed. Can be manually called if you have another scenario for
     * destruction, ie. the element attached to the plugin is removed or changed.
     *
     * This method should be treated as the true destructor of a plugin, and can be overwritten.
     */
    destruct(): void;

    /**
     * Stub detach method. This method is overwritten by the Plugin loader.
     */
    detach(): void;

    /**
     * Plugin destructor (core)
     *
     * The destructor calls some necessary destruction steps, and should not be overwritten
     * unless you absolutely know what you're doing.
     */
    destructor(): void;
}
