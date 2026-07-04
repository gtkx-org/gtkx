import type { RelationshipRule, SyntheticPropRule } from "@gtkx/config";
import { validateGtkxRules } from "@gtkx/config";
import { describe, expect, it } from "vitest";
import { assembleRuleTables } from "../../src/store/react/rule-tables.js";
import { RELATIONSHIP_RULES, SYNTHETIC_PROP_RULES } from "../../src/store/react/tables.js";
import { library } from "../helpers/library.js";

const EMPTY_RULES = { relationships: [], syntheticProps: [] };

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

const relationshipTypeNames = (rule: RelationshipRule): string[] => {
    switch (rule.kind) {
        case "attach":
            return rule.autowrap === undefined ? [rule.parent, rule.child] : [rule.parent, rule.child, rule.autowrap];
        case "companion":
            return [rule.parent];
        case "layout-child":
            return [rule.parent, rule.layout];
        case "reject":
            return [rule.parent, rule.child];
        case "skip":
            return [rule.child];
    }
};

const attachRuleFor = (parent: string, slot?: string) =>
    tables.relationships.find(
        (rule) => rule.kind === "attach" && rule.parent === parent && rule.slot === slot && rule.child === "GtkWidget",
    );

const elementRuleFor = (element: string) =>
    tables.relationships.find(
        (rule) => (rule.kind === "companion" || rule.kind === "layout-child") && rule.element === element,
    );

describe("curated rule tables", () => {
    it("pass schema validation", () => {
        expect(() =>
            validateGtkxRules({ relationships: RELATIONSHIP_RULES, syntheticProps: SYNTHETIC_PROP_RULES }),
        ).not.toThrow();
    });

    it("reference only methods that exist in the loaded GIR", () => {
        const known = knownTypeNames();
        const relationships = RELATIONSHIP_RULES.filter((rule) =>
            relationshipTypeNames(rule).every((name) => known.has(name)),
        );
        const syntheticProps = SYNTHETIC_PROP_RULES.filter((rule) => known.has(rule.type));
        expect(() => assembleRuleTables(library, { relationships, syntheticProps })).not.toThrow();
    });
});

describe("assembled relationship table", () => {
    it("derives container rules from GIR attach probing", () => {
        const box = attachRuleFor("GtkBox");
        expect(box).toMatchObject({
            add: "append",
            remove: "remove",
            insert: { method: "insertChildAfter", args: ["child", "sibling"] },
            reorder: { method: "reorderChildAfter", args: ["child", "sibling"] },
        });
        const bin = attachRuleFor("AdwBin");
        expect(bin).toMatchObject({
            add: "setChild",
            remove: { method: "setChild", args: [{ literal: null }] },
        });
    });

    it("derives single-child rules for non-widget hosts", () => {
        expect(attachRuleFor("GtkListItem")).toMatchObject({ add: "setChild" });
    });

    it("lets the curated autowrap rule override the generated list-box rule", () => {
        expect(attachRuleFor("GtkListBox")).toMatchObject({
            add: "append",
            autowrap: "GtkListBoxRow",
            insert: { method: "insert", args: ["child", "index"] },
        });
    });

    it("keeps companion and layout-child element rules", () => {
        expect(elementRuleFor("GtkStackPage")).toMatchObject({ kind: "companion", add: "addChild" });
        expect(elementRuleFor("GtkNotebookPage")).toMatchObject({
            kind: "companion",
            companion: "getPage",
            setters: { tabLabel: "setTabLabel" },
        });
        expect(elementRuleFor("GtkGridChild")).toMatchObject({ kind: "layout-child", layout: "GtkGridLayout" });
    });

    it("keeps skip rules for toplevels", () => {
        const skipped = tables.relationships.filter((rule) => rule.kind === "skip").map((rule) => rule.child);
        expect(skipped).toEqual(expect.arrayContaining(["GtkWindow", "AdwDialog"]));
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
        const merged = assembleRuleTables(library, { relationships: [], syntheticProps: [override] });
        const marks = merged.syntheticProps.filter((rule) => rule.type === "GtkScale" && rule.prop === "marks");
        expect(marks).toEqual([override]);
    });

    it("reject unknown types with provenance", () => {
        const rule: RelationshipRule = { kind: "attach", parent: "ShumateMap", child: "GtkWidget", add: "add" };
        expect(() => assembleRuleTables(library, { relationships: [rule], syntheticProps: [] })).toThrow(
            /`rules\.relationships\[0\]` references "ShumateMap", which is not a type/,
        );
    });

    it("reject unknown methods with provenance", () => {
        const rule: RelationshipRule = { kind: "attach", parent: "GtkBox", child: "GtkWidget", add: "attachWidget" };
        expect(() => assembleRuleTables(library, { relationships: [rule], syntheticProps: [] })).toThrow(
            /`rules\.relationships\[0\]` references method "attachWidget", which does not exist on GtkBox/,
        );
    });
});
