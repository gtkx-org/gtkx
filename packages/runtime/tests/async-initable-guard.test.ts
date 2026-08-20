import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, typeFromName, typeIsA } from "@gtkx/gi/gobject";
import { getInstanceType, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

class AsyncReady extends GObject implements Gio.AsyncInitableImpl {
    vfuncInitAsync(
        _ioPriority: number,
        cancellable: Gio.Cancellable | null,
        callback: Gio.AsyncReadyCallback | null,
    ): void {
        Gio.Task.new(this, cancellable, callback).returnBoolean(true);
    }

    vfuncInitFinish(res: Gio.AsyncResult): boolean {
        return (res as Gio.Task).propagateBoolean();
    }
}

class AsyncBase extends GObject {
    vfuncInitAsync(
        _ioPriority: number,
        cancellable: Gio.Cancellable | null,
        callback: Gio.AsyncReadyCallback | null,
    ): void {
        Gio.Task.new(this, cancellable, callback).returnBoolean(true);
    }
}

class AsyncLeaf extends AsyncBase implements Gio.AsyncInitableImpl {
    vfuncInitFinish(res: Gio.AsyncResult): boolean {
        return (res as Gio.Task).propagateBoolean();
    }
}

registerClass(AsyncReady, { typeName: uniqueName("GtkxAsyncReady"), implements: [Gio.AsyncInitable] });

describe("registerClass Gio.AsyncInitable guard", () => {
    it("registers and instantiates a class overriding vfuncInitAsync", () => {
        const instance = new AsyncReady();
        expect(instance).toBeInstanceOf(AsyncReady);
        expect(typeIsA(getInstanceType(instance), typeFromName("GAsyncInitable"))).toBe(true);
    });

    it("accepts an override an intermediate base class declares", () => {
        const registered = registerClass(AsyncLeaf, {
            typeName: uniqueName("GtkxAsyncLeaf"),
            implements: [Gio.AsyncInitable],
        });

        expect(new registered()).toBeInstanceOf(AsyncLeaf);
    });

    it("accepts a subclass of a registered class re-listing Gio.AsyncInitable", () => {
        class AsyncGrandchild extends AsyncReady {}

        const registered = registerClass(AsyncGrandchild, {
            typeName: uniqueName("GtkxAsyncGrandchild"),
            implements: [Gio.AsyncInitable],
        });

        expect(new registered()).toBeInstanceOf(AsyncGrandchild);
    });

    it("leaves the synchronous Gio.Initable unaffected", () => {
        class SyncQuiet extends GObject {}

        const registered = registerClass(SyncQuiet, {
            typeName: uniqueName("GtkxSyncQuiet"),
            implements: [Gio.Initable],
        });

        expect(new registered()).toBeInstanceOf(SyncQuiet);
    });

    it("throws when Gio.AsyncInitable is implemented without vfuncInitAsync", () => {
        class AsyncSilent extends GObject implements Gio.AsyncInitableImpl {
            vfuncInitFinish(res: Gio.AsyncResult): boolean {
                return (res as Gio.Task).propagateBoolean();
            }
        }

        expect(() =>
            registerClass(AsyncSilent, {
                typeName: uniqueName("GtkxAsyncSilent"),
                implements: [Gio.AsyncInitable],
            }),
        ).toThrow();
    });
});
