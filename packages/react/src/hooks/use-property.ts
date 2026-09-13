import type { ReadableProperties } from "@gtkx/runtime/internal";
import * as GObject from "@gtkx/gi/gobject";
import { kebabCase } from "@gtkx/utils";
import { getPropertyName } from "../reconciler/metadata.js";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";
import { useObjectValue } from "./use-object-value.js";

/** Every property `T` declares that is also readable off the instance, in camelCase. */
type PropertyName<T extends Pick<GObject.Object, "__properties__" | "__type__">> =
    Extract<keyof NoInfer<ReadableProperties<T>>, string>;

/**
 * Subscribes to a GObject property and returns its current value, re-rendering when the property changes.
 *
 * @param propertyName The camelCase name of a readable property on the object.
 * @returns The current value, or `undefined` while the object is null or an unresolved ref.
 */
function useProperty<T extends Pick<GObject.Object, "__properties__" | "__type__">, P extends PropertyName<T>>(
    object: RefProp<T>,
    propertyName: P,
): ReadableProperties<T>[P] | undefined {
    const resolved = resolveRefProp(object);
    const name = (resolved === null ? undefined : getPropertyName(resolved, propertyName)) ?? kebabCase(propertyName);

    return useObjectValue(object, `notify::${name}`, (obj) =>
        obj === null ? undefined : GObject.getProperty(obj, propertyName),
    );
}

export { useProperty };
