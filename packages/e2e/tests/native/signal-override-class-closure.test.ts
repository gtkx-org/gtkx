import {
    Object as GObject,
    SignalFlags,
    signalLookup,
    signalOverrideClassClosure,
    TYPE_INT,
    TYPE_STRING,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getInstanceType, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";

const uniqueName = createTypeNameFactory("Native");
const OVERRIDE_ANSWER = 42;

describe("signalOverrideClassClosure — installing a default handler", () => {
    it("runs the closure on every emission and hands back its return value", () => {
        class Shouter extends GObject {}

        const Registered = registerClass(Shouter, {
            typeName: uniqueName("GtkxOverrideShouter"),
            signals: { shout: { flags: SignalFlags.RUN_LAST, paramTypes: [TYPE_STRING], returnType: TYPE_INT } },
        });

        const instance = new Registered();
        const gtype = getInstanceType(instance);
        const signalId = signalLookup("shout", gtype);
        expect(signalId).toBeGreaterThan(0);
        const seen: [unknown, string][] = [];

        signalOverrideClassClosure(signalId, gtype, (emitter: GObject, text: string) => {
            seen.push([emitter, text]);

            return OVERRIDE_ANSWER;
        });

        expect(instance.emit("shout", "hey")).toBe(OVERRIDE_ANSWER);
        expect(seen).toEqual([[instance, "hey"]]);
    });
});

describe("signalOverrideClassClosure — edge cases", () => {
    it("overrides an inherited signal for the derived type without touching the parent", () => {
        class Presser extends Gtk.Button {}
        const Registered = registerClass(Presser, { typeName: uniqueName("GtkxOverridePresser") });
        const derived = new Registered();
        const plain = new Gtk.Button();
        const gtype = getInstanceType(derived);
        const signalId = signalLookup("clicked", gtype);
        expect(signalId).toBeGreaterThan(0);
        let runs = 0;

        signalOverrideClassClosure(signalId, gtype, () => {
            runs += 1;
        });

        derived.emit("clicked");
        expect(runs).toBe(1);
        plain.emit("clicked");
        expect(runs).toBe(1);
    });
});

describe("signalOverrideClassClosure — error paths", () => {
    it("throws for a value that is not a closure or a function", () => {
        class Mute extends GObject {}

        const Registered = registerClass(Mute, {
            typeName: uniqueName("GtkxOverrideMute"),
            signals: { hum: {} },
        });

        const instance = new Registered();
        const gtype = getInstanceType(instance);
        const signalId = signalLookup("hum", gtype);

        expect(() => {
            signalOverrideClassClosure(signalId, gtype, 42 as never);
        }).toThrow();

        expect(() => {
            signalOverrideClassClosure(signalId, gtype, {} as never);
        }).toThrow();
    });
});
