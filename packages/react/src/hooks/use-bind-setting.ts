import * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import { toKebabCase } from "@gtkx/utils";
import type { GObjectTarget } from "../utils/gobject-target.js";
import { type SchemaRef, useSettingsInstance } from "./use-setting.js";
import { useTargetRegistration } from "./use-target-registration.js";

export function useBindSetting<K extends object, P extends keyof K & string>(
    schema: SchemaRef<K>,
    key: P,
    target: GObjectTarget<GObject.Object>,
    property: string,
    flags?: Gio.SettingsBindFlags,
): void;
export function useBindSetting(
    schema: SchemaRef,
    key: string,
    target: GObjectTarget<GObject.Object>,
    property: string,
    flags: Gio.SettingsBindFlags = Gio.SettingsBindFlags.DEFAULT,
): void {
    const settings = useSettingsInstance(schema);
    const propertyName = toKebabCase(property);

    useTargetRegistration<GObject.Object, GObject.Object>(target, {
        attach: (object) => {
            settings.bind(key, object, propertyName, flags);
            return object;
        },
        detach: (object) => {
            Gio.Settings.unbind(object, propertyName);
        },
        isSame: (registration, current) => registration === current,
    });
}
