import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { keepAlive, quit, registerClass } from "@gtkx/runtime";

const contexts = new Set<GtkSource.CompletionContext>();
const populated = Promise.withResolvers<void>();

class EmptyProviderBase extends GObject.Object implements GtkSource.CompletionProviderImpl {
    vfuncPopulateAsync(
        context: GtkSource.CompletionContext,
        cancellable: Gio.Cancellable | null,
        callback: Gio.AsyncReadyCallback | null,
    ): void {
        contexts.add(context);
        Gio.Task.new(this, cancellable, callback).returnBoolean(true);
        populated.resolve();
    }

    vfuncPopulateFinish(): Gio.ListModel {
        return Gio.ListStore.new(GObject.Object);
    }
}

const EmptyProvider = registerClass(EmptyProviderBase, {
    typeName: "E2eQuitEmptyProvider",
    implements: [GtkSource.CompletionProvider],
});

const settle = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

const completeInWindow = async (buffer: GtkSource.Buffer): Promise<WeakRef<GtkSource.View>> => {
    const view = GtkSource.View.newWithBuffer(buffer);
    const window = new Gtk.Window();
    window.setChild(view);
    window.present();
    view.grabFocus();
    const completion = view.getCompletion();
    completion.addProvider(new EmptyProvider());

    while (!view.hasFocus()) {
        await settle(10);
    }

    completion.show();
    await populated.promise;
    buffer.insertAtCursor("typed past the completion", -1);
    window.destroy();

    return new WeakRef(view);
};

const collect = async (released: WeakRef<object>): Promise<void> => {
    const { gc } = globalThis;

    if (gc === undefined) {
        throw new Error("The completion quit fixture requires --expose-gc");
    }

    do {
        await settle(10);
        gc();
        await settle(10);
    } while (released.deref() !== undefined);

    await settle(100);
};

keepAlive(true);
GtkSource.init();
const buffer = GtkSource.Buffer.new(null);
await collect(await completeInWindow(buffer));
quit();
