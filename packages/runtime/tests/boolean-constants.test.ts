import { EVENT_PROPAGATE, EVENT_STOP } from "@gtkx/gi/gdk";
import { DBUS_METHOD_INVOCATION_HANDLED, DBUS_METHOD_INVOCATION_UNHANDLED } from "@gtkx/gi/gio";
import { SOURCE_CONTINUE, SOURCE_REMOVE } from "@gtkx/gi/glib";
import { describe, expect, it } from "vitest";

describe("boolean GIR constants", () => {
    it("emits EVENT_STOP and EVENT_PROPAGATE as booleans, not strings", () => {
        expect(EVENT_STOP).toBe(true);
        expect(EVENT_PROPAGATE).toBe(false);
    });

    it("emits SOURCE_CONTINUE and SOURCE_REMOVE as booleans, not strings", () => {
        expect(SOURCE_CONTINUE).toBe(true);
        expect(SOURCE_REMOVE).toBe(false);
    });

    it("emits the D-Bus invocation constants as booleans, not strings", () => {
        expect(DBUS_METHOD_INVOCATION_HANDLED).toBe(true);
        expect(DBUS_METHOD_INVOCATION_UNHANDLED).toBe(false);
    });
});
