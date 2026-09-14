import type * as GObject from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import { kebabCase } from "@gtkx/utils";
import { useLayoutEffect } from "react";
import type { SettingsSchema, SettingsSchemaKeys } from "../utils/settings.js";
import { getPropertyName } from "../reconciler/metadata.js";

/** Options for {@link useBindSetting}. */
type UseBindSettingOptions<K extends SettingsSchemaKeys> = {
    settings: Gio.Settings;
    schema: SettingsSchema<K>;
    /** Key of that schema to bind. */
    key: keyof K & string;
    /** Object holding the property; nothing is bound while it is absent. */
    object: Pick<GObject.Object, "__properties__" | "__type__"> | null | undefined;
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
    settings,
    key,
    object,
    property,
    flags = Gio.SettingsBindFlags.DEFAULT,
}: UseBindSettingOptions<K>): void {
    useLayoutEffect(() => {
        if (object == null) {
            return;
        }

        const propertyName = getPropertyName(object, property) ?? kebabCase(property);
        const target = object as GObject.Object;
        settings.bind(key, target, propertyName, flags);

        return () => {
            Gio.Settings.unbind(target, propertyName);
        };
    }, [settings, key, object, property, flags]);
}

export { useBindSetting };
