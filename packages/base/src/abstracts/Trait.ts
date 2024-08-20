import type TraitInterface from '../interfaces/TraitInterface';
import type Snowboard from '../main/Snowboard';

/**
 * Trait abstract.
 *
 * This class provides the base functionality for all traits.
 */
export default class Trait implements TraitInterface {
    /**
     * Snowboard instance.
     */
    snowboard: Snowboard;

    /**
     * Constructor.
     *
     * The constructor is provided the Snowboard framework instance, and should not be overwritten
     * unless you absolutely know what you're doing.
     */
    constructor(snowboard: Snowboard) {
        this.snowboard = snowboard;
    }

    /**
     * Traits should at the very least define a constructor method.
     */
    construct(): void {
    }

    /**
     * Gets the Snowboard instance that this trait is attached to.
     */
    getSnowboard(): Snowboard {
        return this.snowboard;
    }

    /**
     * Defines the required plugins for this specific trait to work.
     *
     * @returns {string[]} An array of plugins required for this trait to work, as strings.
     */
    dependencies(): string[] {
        return [];
    }

    /**
     * Defines the listener methods for global events.
     */
    listens(): { [key: string]: string | Function } {
        return {};
    }
}
