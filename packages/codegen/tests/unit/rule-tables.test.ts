import type { ContainerProp, SyntheticPropRule } from "@gtkx/config";
import { validateGtkxRules } from "@gtkx/config";
import { describe, expect, it } from "vitest";
import { assembleRuleTables } from "../../src/store/react/rule-tables.js";
import { CONTAINER_PROPS, SYNTHETIC_PROP_RULES } from "../../src/store/react/tables.js";
import { library } from "../helpers/library.js";

const EMPTY_RULES = { containerProps: {}, syntheticProps: [] };

const tables = assembleRuleTables(library, EMPTY_RULES);

const knownTypeNames = (): Set<string> => {
    const names = new Set<string>();
    for (const namespace of library.namespaces.values()) {
        for (const klass of [...namespace.classes, ...namespace.interfaces]) {
            if (klass.glibTypeName !== undefined) names.add(klass.glibTypeName);
        }
    }
    return names;
};

const containerPropTypeNames = (parent: string, cp: ContainerProp): string[] => {
    const names = [parent, cp.child];
    if (cp.autowrap !== undefined) names.push(cp.autowrap);
    return names;
};

const containerPropFor = (parent: string, slot?: string) =>
    (tables.containerProps[parent] ?? []).find((cp) => cp.prop === (slot ?? "children") && cp.child === "GtkWidget");

describe("curated rule tables", () => {
    it("pass schema validation", () => {
        expect(() =>
            validateGtkxRules({ containerProps: CONTAINER_PROPS, syntheticProps: SYNTHETIC_PROP_RULES }),
        ).not.toThrow();
    });

    it("reference only methods that exist in the loaded GIR", () => {
        const known = knownTypeNames();
        const containerProps: Record<string, ContainerProp[]> = {};
        for (const [parent, props] of Object.entries(CONTAINER_PROPS)) {
            const kept = props.filter((cp) => containerPropTypeNames(parent, cp).every((name) => known.has(name)));
            if (kept.length > 0) containerProps[parent] = kept;
        }
        const syntheticProps = SYNTHETIC_PROP_RULES.filter((rule) => known.has(rule.type));
        expect(() => assembleRuleTables(library, { containerProps, syntheticProps })).not.toThrow();
    });
});

describe("assembled container-prop table", () => {
    it("derives container rules from GIR attach probing", () => {
        const box = containerPropFor("GtkBox");
        expect(box).toMatchObject({
            append: "append",
            remove: "remove",
            insert: { method: "insertChildAfter", args: ["child", "sibling"] },
            reorder: { method: "reorderChildAfter", args: ["child", "sibling"] },
        });
        const bin = containerPropFor("AdwBin");
        expect(bin).toMatchObject({
            append: "setChild",
            remove: { method: "setChild", args: [{ literal: null }] },
        });
    });

    it("derives single-child rules for non-widget hosts", () => {
        expect(containerPropFor("GtkListItem")).toMatchObject({ append: "setChild" });
    });

    it("lets the curated autowrap rule override the generated list-box rule", () => {
        expect(containerPropFor("GtkListBox")).toMatchObject({
            append: "append",
            autowrap: "GtkListBoxRow",
            insert: { method: "insert", args: ["child", "index"] },
        });
    });

    it("keeps adopt rules", () => {
        expect(containerPropFor("GtkStack")).toMatchObject({ append: "addChild", adopt: true });
        expect(containerPropFor("GtkNotebook")).toMatchObject({ remove: "detachTab", adopt: "getPage" });
    });
});

describe("assembled synthetic-prop table", () => {
    it("keeps the curated appliers", () => {
        const marks = tables.syntheticProps.find((rule) => rule.type === "GtkScale" && rule.prop === "marks");
        expect(marks).toMatchObject({ kind: "list", clear: "clearMarks" });
        const toggleGroup = tables.syntheticProps.filter((rule) => rule.type === "AdwToggleGroup");
        expect(toggleGroup.map((rule) => rule.prop).sort()).toEqual(["active", "activeName"]);
    });
});

describe("user rules", () => {
    it("override curated rules with the same key", () => {
        const override: SyntheticPropRule = {
            kind: "value",
            type: "GtkScale",
            prop: "marks",
            call: "clearMarks",
        };
        const merged = assembleRuleTables(library, { containerProps: {}, syntheticProps: [override] });
        const marks = merged.syntheticProps.filter((rule) => rule.type === "GtkScale" && rule.prop === "marks");
        expect(marks).toEqual([override]);
    });

    it("reject unknown types with provenance", () => {
        const containerProps = { ShumateMap: [{ prop: "children", child: "GtkWidget", append: "add" }] };
        expect(() => assembleRuleTables(library, { containerProps, syntheticProps: [] })).toThrow(
            /`rules\.containerProps\.ShumateMap\[0\]` references "ShumateMap", which is not a type/,
        );
    });

    it("reject unknown methods with provenance", () => {
        const containerProps = { GtkBox: [{ prop: "children", child: "GtkWidget", append: "attachWidget" }] };
        expect(() => assembleRuleTables(library, { containerProps, syntheticProps: [] })).toThrow(
            /`rules\.containerProps\.GtkBox\[0\]` references method "attachWidget", which does not exist on GtkBox/,
        );
    });
});
