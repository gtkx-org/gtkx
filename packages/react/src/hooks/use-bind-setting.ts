import * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import { toKebabCase } from "@gtkx/utils";
import type { ObjectProp } from "../utils/object-prop.js";
import { useObjectAttachment } from "./use-object-attachment.js";
import { type SchemaRef, useSettingsInstance } from "./use-setting.js";

/**
 * Binds a GSettings key to a property of a GObject, keeping the two in sync for the object's lifetime.
 *
 * @param schema The schema reference identifying the settings backend.
 * @param key The key within the schema to bind.
 * @param object The GObject whose property is bound to the setting.
 * @param property The name of the object property to bind.
 * @param flags Flags controlling the binding's direction and behaviour.
 */
export function useBindSetting<K extends object, P extends keyof K & string>(
    schema: SchemaRef<K>,
    key: P,
    object: ObjectProp<GObject.Object>,
    property: string,
    flags: Gio.SettingsBindFlags = Gio.SettingsBindFlags.DEFAULT
): void {
    const settings = useSettingsInstance(schema);
    const propertyName = toKebabCase(property);

    useObjectAttachment<GObject.Object, GObject.Object>(object, {
        attach: (obj) => {
            settings.bind(key, obj, propertyName, flags);
            return obj;
        },
        detach: (obj) => {
            Gio.Settings.unbind(obj, propertyName);
        },
        isSame: (attachment, current) => attachment === current,
    });
}
