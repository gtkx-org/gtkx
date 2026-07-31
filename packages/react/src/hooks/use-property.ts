import type * as GObject from "@gtkx/gi/gobject";
import { kebabCase } from "@gtkx/utils";
import type { RefProp } from "../utils/ref-prop.js";
import { useObjectValue } from "./use-object-value.js";

type Properties<T extends GObject.Object> = NonNullable<T["__properties__"]>;
/** Every property `T` declares that is also readable off the instance, in camelCase. */
type PropertyName<T extends GObject.Object> = keyof Properties<T> & keyof T;

/**
 * Subscribes to a GObject property and returns its current value, re-rendering when the property changes.
 *
 * @param propertyName The camelCase name of a readable property on the object.
 * @returns The current value, or `undefined` while the object is null or an unresolved ref.
 */
function useProperty<T extends GObject.Object, P extends PropertyName<T>>(
    object: RefProp<T>,
    propertyName: P & string,
): T[P] | undefined {
    return useObjectValue(object, `notify::${kebabCase(propertyName)}`, (obj) => obj?.[propertyName]);
}

export { useProperty, type PropertyName };
