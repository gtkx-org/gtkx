import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { gcUntil } from "./helpers/native-utils.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type Registration = "on" | "once";
type Handler = () => void;

const REGISTRATIONS: Registration[] = ["on", "once"];
const uniqueName = createTypeNameFactory("_");
const newAction = (name: string): Gio.SimpleAction => new Gio.SimpleAction({ name });

const newDialog = (): Gtk.NativeDialog => {
    class ProbeDialog extends Gtk.NativeDialog {}
    registerClass(ProbeDialog, { typeName: uniqueName("GtkxDisposedListenersDialog") });

    return new ProbeDialog();
};

const disposeActionHandler = (
    action: Gio.SimpleAction,
    registration: Registration,
    calls: string[],
): WeakRef<Handler> => {
    const handler = (): void => {
        calls.push("activate");
    };
    action[registration]("activate", handler);
    action.runDispose();
    expect(action.off("activate", handler)).toBe(action);
    expect(action.off("activate", handler)).toBe(action);

    return new WeakRef(handler);
};

const destroyDialogHandler = (dialog: Gtk.NativeDialog, calls: string[]): WeakRef<Handler> => {
    const handler = (): void => {
        calls.push("response");
    };
    dialog.on("response", handler);
    dialog.destroy();
    expect(dialog.off("response", handler)).toBe(dialog);
    expect(dialog.off("response", handler)).toBe(dialog);

    return new WeakRef(handler);
};

describe("listener cleanup after disposal", () => {
    it.each(REGISTRATIONS)("releases a pending %s callback with its emitter retained", async (registration) => {
        const action = newAction(`retained-${registration}`);
        const emitter = new WeakRef(action);
        const calls: string[] = [];
        const handler = disposeActionHandler(action, registration, calls);

        await gcUntil(() => handler.deref() === undefined);

        expect(handler.deref()).toBeUndefined();
        expect(emitter.deref()).toBe(action);
        expect(calls).toEqual([]);
    });

    it.each(REGISTRATIONS)("keeps another emitter's callback connected after %s cleanup", (registration) => {
        const disposed = newAction(`disposed-${registration}`);
        const healthy = newAction(`healthy-${registration}`);
        const calls: string[] = [];
        const handler = (): void => {
            calls.push("activate");
        };
        disposed[registration]("activate", handler);
        healthy.on("activate", handler);

        try {
            healthy.activate(null);
            expect(calls).toEqual(["activate"]);
            disposed.runDispose();
            expect(disposed.off("activate", handler)).toBe(disposed);
            expect(disposed.off("activate", handler)).toBe(disposed);
            healthy.activate(null);
            expect(calls).toEqual(["activate", "activate"]);
            healthy.off("activate", handler);
            healthy.activate(null);
            expect(calls).toEqual(["activate", "activate"]);
        } finally {
            healthy.off("activate", handler);
        }
    });

    it("releases a response callback while retaining the destroyed native dialog", async () => {
        const dialog = newDialog();
        const emitter = new WeakRef(dialog);
        const calls: string[] = [];
        const handler = destroyDialogHandler(dialog, calls);

        await gcUntil(() => handler.deref() === undefined);

        expect(handler.deref()).toBeUndefined();
        expect(emitter.deref()).toBe(dialog);
        expect(calls).toEqual([]);
    });

    it("keeps another emitter's callback connected after native dialog cleanup", () => {
        const dialog = newDialog();
        const healthy = newAction("healthy-dialog");
        const calls: string[] = [];
        const handler = (): void => {
            calls.push("activate");
        };
        dialog.on("response", handler);
        healthy.on("activate", handler);

        try {
            healthy.activate(null);
            expect(calls).toEqual(["activate"]);
            dialog.destroy();
            expect(dialog.off("response", handler)).toBe(dialog);
            expect(dialog.off("response", handler)).toBe(dialog);
            healthy.activate(null);
            expect(calls).toEqual(["activate", "activate"]);
            healthy.off("activate", handler);
            healthy.activate(null);
            expect(calls).toEqual(["activate", "activate"]);
        } finally {
            healthy.off("activate", handler);
        }
    });
});
