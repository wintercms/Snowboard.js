/**
 * Interface abstract.
 *
 * This class provides the base functionality for all traits.
 */
export default interface TraitInterface {
    /**
     * Traits should at the very least define a constructor method.
     */
    construct(): void;

    /**
     * Defines the required plugins for this specific module to work.
     *
     * @returns {string[]} An array of plugins required for this module to work, as strings.
     */
    dependencies?(): string[];

    /**
     * Defines the listener methods for global events.
     */
    listens?(): { [key: string]: string | Function };
}
