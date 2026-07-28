import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { signalHandlerIsConnected } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it, vi } from "vitest";

const GOBJECT_DOMAIN = "GLib-GObject";

const captureCriticals = (run: () => void): string[] => {
    const messages: string[] = [];

    const handler = GLib.logSetHandler(
        GOBJECT_DOMAIN,
        GLib.LogLevelFlags.LEVEL_CRITICAL,
        (_domain, _level, message) => {
            messages.push(message);
        },
    );

    try {
        run();
    } finally {
        GLib.logRemoveHandler(GOBJECT_DOMAIN, handler);
    }

    return messages;
};

const newAction = (name: string): Gio.SimpleAction => new Gio.SimpleAction({ name });

describe("handler ids across disposal", () => {
    it("dispose destroys every handler, so each tracked id goes stale", () => {
        const action = newAction("stale-id");
        const handlerId = action.connect("activate", vi.fn());
        expect(signalHandlerIsConnected(action, BigInt(handlerId))).toBe(true);
        action.runDispose();
        expect(signalHandlerIsConnected(action, BigInt(handlerId))).toBe(false);
    });

    it("never hands a destroyed handler id to a later connection on the same emitter", () => {
        const action = newAction("id-reuse");
        const staleId = action.connect("activate", vi.fn());
        action.runDispose();
        const laterIds = [action.connect("activate", vi.fn()), action.connect("activate", vi.fn())];
        expect(laterIds).not.toContain(staleId);
        expect(Math.min(...laterIds)).toBeGreaterThan(staleId);
    });

    it("leaves a later handler connected when a stale record is disconnected", () => {
        const action = newAction("stale-disconnect");
        const stale = vi.fn();
        action.on("activate", stale);
        action.runDispose();
        const liveId = action.connect("activate", vi.fn());
        captureCriticals(() => action.off("activate", stale));
        expect(signalHandlerIsConnected(action, BigInt(liveId))).toBe(true);
    });
});

describe("listener records that outlive their emitter's disposal", () => {
    it("off() does not disconnect a handler that dispose already destroyed", () => {
        const action = newAction("off-after-dispose");
        const handler = vi.fn();
        action.on("activate", handler);

        const criticals = captureCriticals(() => {
            action.runDispose();
            action.off("activate", handler);
        });

        expect(criticals).toEqual([]);
    });

    it("off() does not disconnect a pending once() handler that dispose already destroyed", () => {
        const action = newAction("once-after-dispose");
        const handler = vi.fn();
        action.once("activate", handler);

        const criticals = captureCriticals(() => {
            action.runDispose();
            action.off("activate", handler);
        });

        expect(criticals).toEqual([]);
        expect(handler).not.toHaveBeenCalled();
    });

    it("off() does not disconnect a handler destroyed by GtkNativeDialog.destroy()", () => {
        const dialog = new Gtk.FileChooserNative();
        const handler = vi.fn();
        dialog.on("response", handler);

        const criticals = captureCriticals(() => {
            dialog.destroy();
            dialog.off("response", handler);
        });

        expect(criticals).toEqual([]);
    });
});
