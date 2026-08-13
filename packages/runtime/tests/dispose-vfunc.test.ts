import { Object as GObject } from "@gtkx/gi/gobject";
import { Box, Window } from "@gtkx/gi/gtk";
import { callParent, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { gcUntil } from "./helpers/native-utils.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type TeardownCounts = { dispose: number; finalize: number };

const MARKER = "kept";
const uniqueName = createTypeNameFactory("_");

function destroyInWindow(child: Box): void {
    const window = new Window({});
    window.setChild(child);
    window.destroy();
}

async function expectDisposedOnce(counts: TeardownCounts): Promise<void> {
    await gcUntil(() => counts.finalize > 0);
    expect(counts).toEqual({ dispose: 1, finalize: 1 });
    await gcUntil(() => false, 20);
    expect(counts).toEqual({ dispose: 1, finalize: 1 });
}

describe("vfuncDispose", () => {
    it("runs once and lets the instance finalize when the wrapper is collected", async () => {
        const counts: TeardownCounts = { dispose: 0, finalize: 0 };

        class DisposedObject extends GObject {
            vfuncDispose(): void {
                counts.dispose += 1;
                callParent(DisposedObject, "vfuncDispose", this);
            }

            vfuncFinalize(): void {
                counts.finalize += 1;
                callParent(DisposedObject, "vfuncFinalize", this);
            }
        }

        registerClass(DisposedObject, { typeName: uniqueName("GtkxDisposeOnce") });
        const weak = new WeakRef(new DisposedObject({}));
        await expectDisposedOnce(counts);
        expect(weak.deref()).toBeUndefined();
    });

    it("runs once for a widget subclass, whose slot resolves through InitiallyUnowned", async () => {
        const counts: TeardownCounts = { dispose: 0, finalize: 0 };

        class DisposedBox extends Box {
            vfuncDispose(): void {
                counts.dispose += 1;
                callParent(DisposedBox, "vfuncDispose", this);
            }

            vfuncFinalize(): void {
                counts.finalize += 1;
                callParent(DisposedBox, "vfuncFinalize", this);
            }
        }

        registerClass(DisposedBox, { typeName: uniqueName("GtkxDisposeOnceBox") });
        destroyInWindow(new DisposedBox({}));
        await expectDisposedOnce(counts);
    });
});

describe("vfuncDispose on an instance that still has its wrapper", () => {
    it("runs against that wrapper, which outlives the call", () => {
        const markers: (string | undefined)[] = [];

        class DisposedWindow extends Window {
            declare marker: string | undefined;

            vfuncDispose(): void {
                markers.push(this.marker);
                callParent(DisposedWindow, "vfuncDispose", this);
            }
        }

        registerClass(DisposedWindow, { typeName: uniqueName("GtkxDisposeWindow") });
        const window = new DisposedWindow({});
        window.marker = MARKER;
        window.setChild(new Box({}));
        window.runDispose();
        expect(markers).toEqual([MARKER]);
        expect(window.getChild()).toBeNull();
    });
});
