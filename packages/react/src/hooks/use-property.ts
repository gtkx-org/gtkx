import * as GObject from "@gtkx/gi/gobject";
import { type propertyMapOverride } from "@gtkx/runtime/internal";
import { kebabCase } from "@gtkx/utils";
import { getPropertyName } from "../reconciler/metadata.js";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";
import { useObjectValue } from "./use-object-value.js";

/** The property map `T` declares, from camelCase property name to value type. */
type Properties<T extends GObject.Object> = T extends { [propertyMapOverride]?: infer TResolver }
    ? TResolver extends () => infer TMap
        ? NonNullable<TMap>
        : T["__properties__"]
    : T["__properties__"];
/** Every property `T` declares that is also readable off the instance, in camelCase. */
type PropertyName<T extends GObject.Object> = Extract<keyof NoInfer<Properties<T>>, string>;

/**
 * Subscribes to a GObject property and returns its current value, re-rendering when the property changes.
 *
 * @param propertyName The camelCase name of a readable property on the object.
 * @returns The current value, or `undefined` while the object is null or an unresolved ref.
 */
function useProperty<T extends GObject.Object, P extends PropertyName<T>>(
    object: RefProp<T>,
    propertyName: P,
): Properties<T>[P] | undefined {
    const resolved = resolveRefProp(object);
    const name = (resolved === null ? undefined : getPropertyName(resolved, propertyName)) ?? kebabCase(propertyName);

    return useObjectValue(object, `notify::${name}`, (obj) =>
        obj === null ? undefined : GObject.getObjectProperty(obj, propertyName),
    );
}

export { useProperty };
