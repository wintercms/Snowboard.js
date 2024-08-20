import type PluginInterface from '../interfaces/PluginInterface';
import type Snowboard from '../main/Snowboard';

/**
 * Plugin base abstract.
 *
 * This class provides the base functionality for all plugins.
 *
 * @copyright 2021 Winter.
 * @author Ben Thomson <git@alfreido.com>
 */
export default class PluginBase implements PluginInterface {
    /**
     * Snowboard instance.
     */
    snowboard: Snowboard;

    /**
     * Is this plugin instance destructed?
     */
    destructed: boolean = false;

    /**
     * Constructor.
     *
     * The constructor is provided the Snowboard framework instance, and should not be overwritten
     * unless you absolutely know what you're doing.
     */
    constructor(snowboard: Snowboard) {
        this.snowboard = snowboard;
        this.destructed = false;
    }

    /**
     * Gets the Snowboard instance that this plugin is attached to.
     */
    getSnowboard(): Snowboard {
        return this.snowboard;
    }

    /**
     * Determines if this plugin is a singleton.
     */
    isSingleton(): boolean {
        return false;
    }

    /**
     * Plugin constructor.
     *
     * This method should be treated as the true constructor of a plugin, and can be overwritten.
     * It will be called straight after construction, but before traits are loaded, allowing you
     * to define any required properties needed for the traits.
     */
    construct(): void {
    }

    /**
     * Plugin initializer.
     *
     * This method is call after construction is complete and after traits are loaded. It can be
     * used to run any functionality that you want available immediately after the plugin instance
     * is ready to use.
     */
    init(): void {
    }

    /**
     * Defines the required plugins for this specific module to work.
     *
     * @returns {string[]} An array of plugins required for this module to work, as strings.
     */
    dependencies(): string[] {
        return [];
    }

    /**
     * Defines the traits to include with this plugin.
     */
    traits(): string[] {
        return [];
    }

    /**
     * Defines the listener methods for global events.
     */
    listens(): { [key: string]: string | Function } {
        return {};
    }

    /**
     * Plugin destructor.
     *
     * Fired when this plugin is removed. Can be manually called if you have another scenario for
     * destruction, ie. the element attached to the plugin is removed or changed.
     *
     * This method should be treated as the true destructor of a plugin, and can be overwritten.
     */
    destruct(): void {
    }

    /**
     * Stub detach method. This method is overwritten by the Plugin loader.
     */
    detach(): void {
    }

    /**
     * Plugin destructor (core)
     *
     * The destructor calls some necessary destruction steps, and should not be overwritten
     * unless you absolutely know what you're doing.
     */
    destructor(): void {
        this.destruct();
        this.detach();
        this.destructed = true;
    }
}
