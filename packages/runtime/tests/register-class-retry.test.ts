import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

const occupyName = (): string => {
    const name = uniqueName("GtkxRetryOccupied");
    class Occupant extends GObject.Object {}
    registerClass(Occupant, { typeName: name });

    return name;
};

describe("registerClass retry after a rejected registration", () => {
    it("uses the successful property's defaults, range and native dispatch", () => {
        const occupied = occupyName();
        class Retried extends GObject.Object {
            declare retryLevel: number;
        }

        expect(() => registerClass(Retried, {
            typeName: occupied,
            properties: {
                retryLevel: GObject.paramSpecInt("retry-level", null, null, 0, 10, 3, GObject.ParamFlags.READWRITE),
            },
        })).toThrow();

        registerClass(Retried, {
            typeName: uniqueName("GtkxRetryProperties"),
            properties: {
                retryLevel: GObject.paramSpecInt("retry-level", null, null, 0, 100, 20, GObject.ParamFlags.READWRITE),
            },
        });

        expect(new Retried().retryLevel).toBe(20);
        const instance = new Retried({ retryLevel: 80 });
        expect(instance.retryLevel).toBe(80);
        const observed: number[] = [];
        const handler = (): void => {
            observed.push(instance.retryLevel);
        };
        instance.on("notify::retry-level", handler);
        const value = new GObject.Value();
        value.init(GObject.TYPE_INT);

        try {
            instance.retryLevel = 90;
            instance.getProperty("retry-level", value);
            expect(value.getInt()).toBe(90);
            value.setInt(75);
            instance.setProperty("retry-level", value);
            expect(instance.retryLevel).toBe(75);

            expect(() => {
                instance.retryLevel = 101;
            }).toThrow();

            expect(instance.retryLevel).toBe(75);
            instance.retryLevel = 100;
            expect(observed).toEqual([90, 75, 100]);
        } finally {
            instance.off("notify::retry-level", handler);
            value.unset();
        }
    });

    it("can declare a property after an attempt with no properties", () => {
        const occupied = occupyName();
        class Retried extends GObject.Object {
            declare label: string;
        }

        expect(() => registerClass(Retried, { typeName: occupied })).toThrow();

        registerClass(Retried, {
            typeName: uniqueName("GtkxRetryEmpty"),
            properties: {
                label: GObject.paramSpecString("label", null, null, "ready", GObject.ParamFlags.READWRITE),
            },
        });

        const instance = new Retried();
        expect(instance.label).toBe("ready");
        instance.label = "updated";
        const value = new GObject.Value();
        value.init(GObject.TYPE_STRING);
        try {
            instance.getProperty("label", value);
            expect(value.getString()).toBe("updated");
        } finally {
            value.unset();
        }
    });
});
