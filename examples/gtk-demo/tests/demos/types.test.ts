import { describe, expect, it } from "vitest";
import type { Demo, DemoProps, TreeItem } from "../../src/demos/types.js";

describe("demos/types module", () => {
    it("compiles with the expected shape for Demo, DemoProps, and TreeItem", () => {
        const demo: Demo = { id: "x", title: "X", description: "x", keywords: [] };
        const props: DemoProps = { window: { current: null } };
        const item: TreeItem = { type: "demo", demo, displayTitle: "X" };
        expect(demo.id).toBe("x");
        expect(props.window.current).toBeNull();
        expect(item.type).toBe("demo");
    });
});
