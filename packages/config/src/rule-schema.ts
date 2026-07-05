import type { GtkxRules, ResolvedGtkxRules } from "./rule-validation.js";

export const RELATIONSHIP_NODE_ELEMENT = "__GTKX_RELATIONSHIP_NODE__";

export const RELATIONSHIP_KINDS = [
    "companion",
    "widget-prop",
    "container-slot",
    "text-anchor",
    "text-paintable",
    "buffer-text",
    "label-text",
] as const;

export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

const RELATIONSHIP_KIND_SET: ReadonlySet<string> = new Set(RELATIONSHIP_KINDS);

export const isRelationshipKind = (value: unknown): value is RelationshipKind =>
    typeof value === "string" && RELATIONSHIP_KIND_SET.has(value);

export const COMPANION_KIND: RelationshipKind = "companion";

export const WIDGET_PROP_KIND: RelationshipKind = "widget-prop";

export const CONTAINER_SLOT_KIND: RelationshipKind = "container-slot";

export const TEXT_ANCHOR_KIND: RelationshipKind = "text-anchor";

export const TEXT_PAINTABLE_KIND: RelationshipKind = "text-paintable";

export const BUFFER_TEXT_KIND: RelationshipKind = "buffer-text";

export const LABEL_TEXT_KIND: RelationshipKind = "label-text";

export const resolveGtkxRules = (rules: GtkxRules | undefined): ResolvedGtkxRules => ({
    relationships: rules?.relationships ?? [],
    syntheticProps: rules?.syntheticProps ?? [],
});
