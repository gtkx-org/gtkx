import type * as GObject from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import { kebabCase } from "@gtkx/utils";
import { useLayoutEffect, useRef } from "react";
import type { SettingsSchema, SettingsSchemaKeys } from "../utils/settings.js";
import { getPropertyName } from "../reconciler/metadata.js";
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

const releaseBinding = (
    bindingRef: {
        current: [Gio.Settings, string, GObject.Object, string, Gio.SettingsBindFlags] | null;
    },
): void => {
    const current = bindingRef.current;

    if (current !== null) {
        Gio.Settings.unbind(current[2], current[3]);
        bindingRef.current = null;
    }
};

const isCurrentBinding = (
    current: readonly [Gio.Settings, string, GObject.Object, string, Gio.SettingsBindFlags] | null,
    next: {
        settings: Gio.Settings;
        key: string;
        object: GObject.Object;
        property: string;
        flags: Gio.SettingsBindFlags;
    },
): boolean => current !== null &&
    current[0] === next.settings &&
    current[1] === next.key &&
    current[2] === next.object &&
    current[3] === next.property &&
    current[4] === next.flags;

const updateBinding = ({
    bindingRef,
    settings,
    key,
    object,
    property,
    flags,
}: {
    bindingRef: { current: [Gio.Settings, string, GObject.Object, string, Gio.SettingsBindFlags] | null };
    settings: Gio.Settings;
    key: string;
    object: RefProp<GObject.Object>;
    property: string;
    flags: Gio.SettingsBindFlags;
}): void => {
    const resolved = resolveRefProp(object);

    if (resolved === null) {
        releaseBinding(bindingRef);

        return;
    }

    const propertyName = getPropertyName(resolved, property) ?? kebabCase(property);
    const next = { settings, key, object: resolved, property: propertyName, flags };

    if (isCurrentBinding(bindingRef.current, next)) {
        return;
    }

    releaseBinding(bindingRef);
    settings.bind(key, resolved, propertyName, flags);
    bindingRef.current = [settings, key, resolved, propertyName, flags];
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
    const bindingRef = useRef<[Gio.Settings, string, GObject.Object, string, Gio.SettingsBindFlags] | null>(null);

    useLayoutEffect(() => {
        updateBinding({ bindingRef, settings, key, object, property, flags });
    });

    useLayoutEffect(() => {
        return () => {
            releaseBinding(bindingRef);
        };
    }, []);
}

export { useBindSetting };
