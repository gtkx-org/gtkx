import { Object as GObject } from "@gtkx/gi/gobject";
import { callParent, getHandle, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { gcUntil } from "../helpers/native-utils.js";
import { createTypeNameFactory } from "../helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

describe("vfuncFinalize", () => {
    it("runs once against a usable instance when the wrapper is collected", async () => {
        const instances: object[] = [];
        const handles: unknown[] = [];

        class FinalizedObject extends GObject {
            vfuncFinalize(): void {
                instances.push(this);
                handles.push(getHandle(this));
                callParent(FinalizedObject, "vfuncFinalize", this);
            }
        }

        registerClass(FinalizedObject, { typeName: uniqueName("GtkxFinalizeOnce") });
        const weak = new WeakRef(new FinalizedObject({}));
        await gcUntil(() => instances.length > 0);
        expect(weak.deref()).toBeUndefined();
        expect(instances).toHaveLength(1);
        expect(instances[0]).toBeInstanceOf(FinalizedObject);
        expect(handles[0]).toBeDefined();
        await gcUntil(() => false, 5);
        expect(instances).toHaveLength(1);
    });
});
