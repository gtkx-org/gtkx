import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { propertyNotFoundError, type SerializedProperty } from "@gtkx/mcp/internal";
import {
    type ExternalObject,
    getHandle,
    getInstanceType,
    type Handle,
    TYPE_ENUM,
    TYPE_FLAGS,
    typeIsA,
    typeName,
} from "@gtkx/runtime";
import { fromValue, getValueType } from "@gtkx/runtime/internal";
import { camelCase, errorMessage, kebabCase } from "@gtkx/utils";
import type { WidgetRegistry } from "./widget-registry.js";

type PropertyRepresentation = Omit<SerializedProperty, "type">;
type NativeProperty = { type: bigint; handle: ExternalObject<Handle> };

const SCALAR_TYPES: Set<string> = new Set(["string", "number", "boolean"]);

const canonicalName = (name: string): string => kebabCase(name).replaceAll("_", "-");
const widgetTypeName = (widget: Gtk.Widget): string => typeName(getInstanceType(widget)) ?? widget.constructor.name;
const byName = (left: string, right: string): number => left.localeCompare(right);

const isScalar = (value: unknown): value is string | number | boolean | null =>
    value === null || SCALAR_TYPES.has(typeof value);

function prototypesFor(widget: Gtk.Widget): object[] {
    const prototypes: object[] = [];
    let prototype = Object.getPrototypeOf(widget) as object | null;

    while (prototype !== null && prototype !== Object.prototype) {
        prototypes.push(prototype);
        prototype = Object.getPrototypeOf(prototype) as object | null;
    }

    return prototypes;
}

function getAccessor(widget: Gtk.Widget, member: string): PropertyDescriptor | undefined {
    for (const prototype of prototypesFor(widget)) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, member);

        if (descriptor !== undefined) {
            return descriptor;
        }
    }

    return undefined;
}

function getReadableNames(prototype: object): string[] {
    const descriptors = Object.entries(Object.getOwnPropertyDescriptors(prototype));

    return descriptors.filter(([, descriptor]) => descriptor.get !== undefined).map(([member]) => kebabCase(member));
}

function readablePropertyNames(widget: Gtk.Widget): string[] {
    const names = prototypesFor(widget).flatMap((prototype) => getReadableNames(prototype));

    return [...new Set(names)].toSorted(byName);
}

const requireReadableProperty = (widget: Gtk.Widget, property: string): void => {
    if (getAccessor(widget, camelCase(property))?.get !== undefined) {
        return;
    }

    throw propertyNotFoundError(widgetTypeName(widget), property, readablePropertyNames(widget));
};

function readNativeProperty(widget: Gtk.Widget, property: string): NativeProperty {
    const value = new GObject.Value();
    widget.getProperty(property, value);
    const handle = getHandle(value);

    return { type: getValueType(handle), handle };
}

function describeObjectValue(value: unknown, registry: WidgetRegistry): PropertyRepresentation {
    if (typeof value !== "object" || value === null) {
        return { value: String(value) };
    }

    const name = typeName(getInstanceType(value)) ?? value.constructor.name;

    if (!(value instanceof Gtk.Widget)) {
        return { value: name };
    }

    registry.register(value);

    return { value: name, widgetId: registry.getOrCreateId(value) };
}

function representValue(value: unknown, registry: WidgetRegistry): PropertyRepresentation {
    if (isScalar(value)) {
        return { value };
    }

    if (typeof value === "bigint") {
        return { value: value.toString() };
    }

    if (Array.isArray(value)) {
        return { value: value.map(String) };
    }

    return describeObjectValue(value, registry);
}

function representNativeProperty(native: NativeProperty, registry: WidgetRegistry): PropertyRepresentation {
    if (typeIsA(native.type, TYPE_ENUM)) {
        return { value: GObject.enumToString(native.type, Number(fromValue(native.handle))) };
    }

    if (typeIsA(native.type, TYPE_FLAGS)) {
        return { value: GObject.flagsToString(native.type, Number(fromValue(native.handle))) };
    }

    return representValue(fromValue(native.handle), registry);
}

function serializeProperty(widget: Gtk.Widget, property: string, registry: WidgetRegistry): SerializedProperty {
    const native = readNativeProperty(widget, property);
    const type = typeName(native.type) ?? String(native.type);

    try {
        return { type, ...representNativeProperty(native, registry) };
    } catch (error) {
        return { type, value: null, note: `cannot be represented over MCP: ${errorMessage(error)}` };
    }
}

function readWidgetProperties(
    widget: Gtk.Widget,
    properties: string[],
    registry: WidgetRegistry,
): Record<string, SerializedProperty> {
    const values: Record<string, SerializedProperty> = {};

    for (const name of properties) {
        const property = canonicalName(name);
        requireReadableProperty(widget, property);
        values[property] = serializeProperty(widget, property, registry);
    }

    return values;
}

export { readWidgetProperties };
