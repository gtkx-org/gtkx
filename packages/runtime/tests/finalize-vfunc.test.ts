import { Object as GObject } from "@gtkx/gi/gobject";
import { Box } from "@gtkx/gi/gtk";
import { getType } from "@gtkx/native";
import { callParent, getHandle, registerClass, TYPE_INVALID } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { gcUntil } from "./helpers/native-utils.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type EscapedReceiver = { getData: (key: string) => number | null };

const REVOKED_RECEIVER = /only valid until the override returns/;
const uniqueName = createTypeNameFactory("_");

async function expectFinalizedOnce(finalized: boolean[], weak: WeakRef<object>): Promise<void> {
    await gcUntil(() => finalized.length > 0);
    expect(weak.deref()).toBeUndefined();
    expect(finalized).toEqual([true]);
    await gcUntil(() => false, 20);
    expect(finalized).toEqual([true]);
}

describe("vfuncFinalize", () => {
    it("runs once against a usable instance when the wrapper is collected", async () => {
        const finalized: boolean[] = [];

        class FinalizedObject extends GObject {
            vfuncFinalize(): void {
                finalized.push(this instanceof FinalizedObject);
                callParent(FinalizedObject, "vfuncFinalize", this);
            }
        }

        registerClass(FinalizedObject, { typeName: uniqueName("GtkxFinalizeOnce") });
        await expectFinalizedOnce(finalized, new WeakRef(new FinalizedObject({})));
    });

    it("runs once for a widget subclass, whose slot resolves through InitiallyUnowned", async () => {
        const finalized: boolean[] = [];

        class FinalizedBox extends Box {
            vfuncFinalize(): void {
                finalized.push(this instanceof FinalizedBox);
                callParent(FinalizedBox, "vfuncFinalize", this);
            }
        }

        registerClass(FinalizedBox, { typeName: uniqueName("GtkxFinalizeOnceBox") });
        await expectFinalizedOnce(finalized, new WeakRef(new FinalizedBox({})));
    });
});

describe("a teardown receiver GTKX built for the call", () => {
    it("is revoked once the override returns", async () => {
        const escaped: EscapedReceiver[] = [];

        class EscapingObject extends GObject {
            vfuncFinalize(): void {
                escaped.push(this);
                callParent(EscapingObject, "vfuncFinalize", this);
            }
        }

        registerClass(EscapingObject, { typeName: uniqueName("GtkxFinalizeEscape") });
        const weak = new WeakRef(new EscapingObject({}));
        await gcUntil(() => escaped.length > 0);
        expect(weak.deref()).toBeUndefined();
        const [receiver] = escaped;

        if (receiver === undefined) {
            throw new Error("the override never ran");
        }

        expect(() => receiver.getData("gtkx")).toThrow(REVOKED_RECEIVER);
        expect(getType(getHandle(receiver))).toBe(TYPE_INVALID);
    });
});
