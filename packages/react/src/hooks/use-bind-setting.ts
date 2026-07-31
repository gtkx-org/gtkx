import type * as GObject from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import { kebabCase } from "@gtkx/utils";
import { useLayoutEffect } from "react";
import type { SettingsSchema, SettingsSchemaKeys } from "../utils/settings.js";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";
import { useSettings } from "./use-setting.js";

/** Options for {@link useBindSetting}. */
type UseBindSettingOptions<K extends SettingsSchemaKeys> = {
    /** Schema the settings object is opened from. */
    schema: SettingsSchema<K>;
    /** Key of that schema to bind. */
    key: keyof K & string;
    /** Object holding the property, given directly or as a ref; nothing is bound while it is absent. */
    object: RefProp<GObject.Object>;
    /** camelCase name of the property to keep in sync with the key. */
    property: string;
    /** Direction and conversion behavior of the bind; defaults to `Gio.SettingsBindFlags.DEFAULT`. */
    flags?: Gio.SettingsBindFlags;
};

/**
 * Binds a GSettings key to a property of a GObject, keeping the two in sync until the component unmounts.
 * `property` is given in camelCase, and `flags` defaults to `Gio.SettingsBindFlags.DEFAULT`, a two-way bind.
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
