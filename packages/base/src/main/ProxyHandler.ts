import type Snowboard from "./Snowboard";

export default {
    get(target: Snowboard, prop: any, receiver: unknown) {
        if (typeof prop === 'string' && target.hasAbstract(prop)) {
            return Reflect.get(target, 'abstracts')
                .get(prop);
        }
        if (typeof prop === 'string' && target.hasPlugin(prop)) {
            return (...params: any[]) => Reflect.get(target, 'plugins')
                .get(prop.toLowerCase())
                .getInstance(...params);
        }

        return Reflect.get(target, prop, receiver);
    },

    has(target: Snowboard, prop: PropertyKey) {
        if (typeof prop === 'string' && target.hasAbstract(prop)) {
            return true;
        }
        if (typeof prop === 'string' && target.hasPlugin(prop)) {
            return true;
        }

        return Reflect.has(target, prop);
    },

    deleteProperty(target: Snowboard, prop: PropertyKey) {
        if (typeof prop === 'string' && target.hasPlugin(prop)) {
            target.removePlugin(prop);
            return true;
        }

        return false;
    },
};
