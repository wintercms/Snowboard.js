/**
 * Prototype object.
 *
 * Represents a prototyped object.
 */
export default interface PrototypedObject {
    /**
     * Plugin prototype.
     */
    prototype: any;

    /**
     * Constructor.
     */
    constructor(...args: any[]): any;
}
