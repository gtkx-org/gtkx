import type * as GObject from "@gtkx/gi/gobject";
import type { Props } from "./registry.js";

type LazyPublicInstanceChannel = {
    token: object;
    publish: (instance: GObject.Object | null) => void;
};

const LAZY_PUBLIC_INSTANCE_PROP = "__gtkx_internal_lazy_public_instance__";
const channelToken: object = {};

const createLazyPublicInstanceChannel = (
    publish: (instance: GObject.Object | null) => void,
): LazyPublicInstanceChannel => ({ token: channelToken, publish });

const isLazyPublicInstanceChannel = (value: unknown): value is LazyPublicInstanceChannel => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    return Reflect.get(value, "token") === channelToken && typeof Reflect.get(value, "publish") === "function";
};

const publishLazyPublicInstance = (props: Props, instance: GObject.Object | null): void => {
    const channel = props[LAZY_PUBLIC_INSTANCE_PROP];

    if (isLazyPublicInstanceChannel(channel)) {
        channel.publish(instance);
    }
};

export { createLazyPublicInstanceChannel, LAZY_PUBLIC_INSTANCE_PROP, publishLazyPublicInstance };
