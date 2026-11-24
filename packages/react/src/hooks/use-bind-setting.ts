import type * as GObject from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import { kebabCase } from "@gtkx/utils";
import { useLayoutEffect } from "react";
import type { SettingsSchema, SettingsSchemaKeys } from "../utils/settings.js";
import { useSettingsScope } from "../components/settings-context.js";
import { getPropertyName } from "../reconciler/metadata.js";
import type { WritablePropertyName } from "./use-property.js";

/** Options for {@link useBindSetting}. */
type UseBindSettingOptions<
    K extends SettingsSchemaKeys,
    T extends Pick<GObject.Object, "__properties__" | "__type__">,
> = {
    /** Schema declaring the key, whose instance the nearest `SettingsProvider` for it supplies. */
    schema: SettingsSchema<K>;
    /** Key of that schema to bind. */
    key: keyof K & string;
    /** Object holding the property; nothing is bound while it is absent. */
    object: T | null | undefined;
    /** camelCase name of a writable property of the object to keep in sync with the key. */
    property: WritablePropertyName<T>;
    /** Direction and conversion behavior of the bind; defaults to `Gio.SettingsBindFlags.DEFAULT`. */
    flags?: Gio.SettingsBindFlags;
};

/**
 * Binds a GSettings key to a property of a GObject, keeping the two in sync until the component unmounts.
 * `property` is given in camelCase, and `flags` defaults to `Gio.SettingsBindFlags.DEFAULT`, a two-way bind.
 *
 * @throws When no `SettingsProvider` for the schema is rendered above.
 */
function useBindSetting<K extends SettingsSchemaKeys, T extends Pick<GObject.Object, "__properties__" | "__type__">>({
    schema,
    key,
    object,
    property,
    flags = Gio.SettingsBindFlags.DEFAULT,
}: UseBindSettingOptions<K, T>): void {
    const { settings } = useSettingsScope(schema);

    useLayoutEffect(() => {
        if (object == null) {
            return;
        }

        const propertyName = getPropertyName(object, property) ?? kebabCase(property);
        const holder: Pick<GObject.Object, "__properties__" | "__type__"> = object;
        const target = holder as GObject.Object;
        settings.bind(key, target, propertyName, flags);

        return () => {
            Gio.Settings.unbind(target, propertyName);
        };
    }, [settings, key, object, property, flags]);
}

export { useBindSetting };
