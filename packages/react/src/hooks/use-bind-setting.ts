import type * as GObject from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import { kebabCase } from "@gtkx/utils";
import { useLayoutEffect } from "react";
import type { SettingsSchema, SettingsSchemaKeys } from "../utils/settings.js";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";
import { useSettings } from "./use-setting.js";

type UseBindSettingOptions<K extends SettingsSchemaKeys> = {
    schema: SettingsSchema<K>;
    key: keyof K & string;
    object: RefProp<GObject.Object>;
    property: string;
    flags?: Gio.SettingsBindFlags;
};

/**
 * Binds a GSettings key to a property of a GObject, keeping the two in sync for the object's lifetime.
 *
 * @param options.schema The schema reference identifying the settings backend.
 * @param options.key The key within the schema to bind.
 * @param options.object The GObject whose property is bound to the setting.
 * @param options.property The name of the object property to bind.
 * @param options.flags Flags controlling the binding's direction and behaviour.
 */
function useBindSetting<K extends SettingsSchemaKeys>({
    schema,
    key,
    object,
    property,
    flags = Gio.SettingsBindFlags.DEFAULT,
}: UseBindSettingOptions<K>): void {
    const settings = useSettings(schema);
    const propertyName = kebabCase(property);

    useLayoutEffect(() => {
        const resolved = resolveRefProp(object);

        if (!resolved) {
            return;
        }

        settings.bind(key, resolved, propertyName, flags);

        return () => {
            Gio.Settings.unbind(resolved, propertyName);
        };
    }, [settings, key, object, propertyName, flags]);
}

export { useBindSetting };
