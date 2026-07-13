import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ContainerProp, type ElementProp, loadConfig } from "@gtkx/config";
import { describe, expect, it } from "vitest";
import { BUILT_IN_ELEMENT_PROPS } from "../../src/store/react/built-ins.js";
import { assembleElementProps } from "../../src/store/react/element-props.js";
import { buildGirIndex } from "../../src/store/react/gir-index.js";
import { library } from "../helpers/library.js";

const girIndex = buildGirIndex(library);
const elementProps = assembleElementProps(girIndex, {});

const knownTypeNames = (): Set<string> => {
    const names = new Set<string>();
    for (const namespace of library.namespaces.values()) {
        for (const klass of [...namespace.classes, ...namespace.interfaces]) {
            if (klass.glibTypeName !== undefined) names.add(klass.glibTypeName);
        }
    }
    return names;
};

const containerTypeNames = (parent: string, cp: ContainerProp): string[] => {
    const names = [parent, cp.child];
    if (cp.autowrap !== undefined) names.push(cp.autowrap);
    return names;
};

const containerPropFor = (parent: string, slot?: string): ContainerProp | undefined =>
    (elementProps[parent] ?? []).find(
        (prop): prop is ContainerProp =>
            prop.kind === "container" && prop.prop === (slot ?? "children") && prop.child === "GtkWidget",
    );

describe("curated element props", () => {
    it("pass schema validation", async () => {
        const root = await mkdtemp(join(tmpdir(), "gtkx-curated-"));
        try {
            const source = `export default { applicationId: "org.gtk.Test", elementProps: ${JSON.stringify(BUILT_IN_ELEMENT_PROPS)} };\n`;
            await writeFile(join(root, "gtkx.config.ts"), source);
            await expect(loadConfig(root)).resolves.toMatchObject({ root });
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("reference only types and methods that exist in the loaded GIR", () => {
        const known = knownTypeNames();
        const filtered: Record<string, ElementProp[]> = {};
        for (const [parent, props] of Object.entries(BUILT_IN_ELEMENT_PROPS)) {
            if (!known.has(parent)) continue;
            const kept = props.filter(
                (prop) =>
                    prop.kind !== "container" || containerTypeNames(parent, prop).every((name) => known.has(name)),
            );
            if (kept.length > 0) filtered[parent] = kept;
        }
        expect(() => assembleElementProps(girIndex, filtered)).not.toThrow();
    });
});

describe("assembled container props", () => {
    it("curates box children with insertion and reordering", () => {
        expect(containerPropFor("GtkBox")).toMatchObject({
            append: "append",
            remove: "remove",
            insert: { method: "insertChildAfter", args: ["child", "sibling"] },
            reorder: { method: "reorderChildAfter", args: ["child", "sibling"] },
        });
    });

    it("curates single-child container props for set_child hosts", () => {
        expect(containerPropFor("GtkButton")).toMatchObject({
            append: "setChild",
            remove: { method: "setChild", args: [{ literal: null }] },
        });
        expect(containerPropFor("GtkListItem")).toMatchObject({ append: "setChild" });
    });

    it("curates the autowrap list-box container prop", () => {
        expect(containerPropFor("GtkListBox")).toMatchObject({
            append: "append",
            autowrap: "GtkListBoxRow",
            insert: { method: "insert", args: ["child", "index"] },
        });
    });

    it("keeps adopt container props", () => {
        expect(containerPropFor("GtkStack")).toMatchObject({ append: "addChild", adopt: true });
        expect(containerPropFor("GtkNotebook")).toMatchObject({ remove: "detachTab", adopt: "getPage" });
    });
});

describe("assembled applied props", () => {
    it("keeps the curated value and lazy props", () => {
        const draw = (elementProps.GtkDrawingArea ?? []).find((prop) => prop.kind === "value");
        expect(draw).toMatchObject({ prop: "drawFunc", call: "setDrawFunc", after: "queueDraw" });
        const toggle = (elementProps.AdwToggleGroup ?? []).filter((prop) => prop.kind !== "container");
        expect(toggle.map((prop) => prop.prop).sort()).toEqual(["active", "activeName"]);
    });

    it("keeps single-argument value-prop shorthands as bare method names", () => {
        const types = (elementProps.GtkDropTarget ?? []).find((prop) => prop.kind === "value");
        expect(types).toEqual({ kind: "value", prop: "types", call: "setGtypes" });
    });

    it("expands a multi-argument value-prop shorthand into args with inferred defaults", () => {
        const icon = (elementProps.GtkDragSource ?? []).find((prop) => prop.kind === "value");
        expect(icon).toEqual({
            kind: "value",
            prop: "icon",
            call: {
                method: "setIcon",
                args: [
                    { field: "paintable", or: null },
                    { field: "hotX", or: 0 },
                    { field: "hotY", or: 0 },
                ],
            },
        });
    });

    it("infers defaults for numeric and nullable list-item fields but not enums", () => {
        const marks = (elementProps.GtkScale ?? []).find((prop) => prop.kind === "list");
        expect(marks).toEqual({
            kind: "list",
            prop: "marks",
            add: {
                method: "addMark",
                args: [{ field: "value", or: 0 }, { field: "position" }, { field: "markup", or: null }],
            },
            clear: "clearMarks",
        });
    });
});

describe("user element props", () => {
    it("override curated props with the same key", () => {
        const override: ElementProp = { kind: "value", prop: "drawFunc", call: "setDrawFunc" };
        const merged = assembleElementProps(girIndex, { GtkDrawingArea: [override] });
        const applied = (merged.GtkDrawingArea ?? []).filter((prop) => prop.kind !== "container");
        expect(applied).toEqual([override]);
    });

    it("reject unknown types with provenance", () => {
        const props: Record<string, ElementProp[]> = {
            ShumateMap: [{ kind: "container", prop: "children", child: "GtkWidget", append: "add" }],
        };
        expect(() => assembleElementProps(girIndex, props)).toThrow(
            /`elementProps\.ShumateMap\[0\]` references "ShumateMap", which is not a type/,
        );
    });

    it("reject unknown methods with provenance", () => {
        const props: Record<string, ElementProp[]> = {
            GtkBox: [{ kind: "container", prop: "children", child: "GtkWidget", append: "attachWidget" }],
        };
        expect(() => assembleElementProps(girIndex, props)).toThrow(
            /`elementProps\.GtkBox\[0\]` references method "attachWidget", which does not exist on GtkBox/,
        );
    });
});
