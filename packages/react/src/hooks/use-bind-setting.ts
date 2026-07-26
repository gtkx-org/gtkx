import type * as GObject from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import { kebabCase } from "@gtkx/utils";
import { useLayoutEffect } from "react";
import type { SettingsSchema, SettingsSchemaKeys } from "../utils/settings.js";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";
import { useSettings } from "./use-setting.js";

/**
 * Binds a GSettings key to a property of a GObject, keeping the two in sync for the object's lifetime.
 *
 * @param schema The schema reference identifying the settings backend.
 * @param key The key within the schema to bind.
 * @param object The GObject whose property is bound to the setting.
 * @param property The name of the object property to bind.
 * @param flags Flags controlling the binding's direction and behaviour.
 */
export function useBindSetting<K extends SettingsSchemaKeys>(
    schema: SettingsSchema<K>,
    key: keyof K & string,
    object: RefProp<GObject.Object>,
    property: string,
    flags: Gio.SettingsBindFlags = Gio.SettingsBindFlags.DEFAULT,
): void {
    const settings = useSettings(schema);
    const propertyName = kebabCase(property);

    useLayoutEffect(() => {
        const resolved = resolveRefProp(object);
        if (!resolved) return;

        settings.bind(key, resolved, propertyName, flags);

        return () => {
            Gio.Settings.unbind(resolved, propertyName);
        };
    }, [settings, key, object, propertyName, flags]);
}
