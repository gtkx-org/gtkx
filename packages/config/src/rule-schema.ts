import type { GtkxRules, ResolvedGtkxRules } from "./rule-validation.js";

export const WRAPPER_NODE_ELEMENT = "__GTKX_WRAPPER_NODE__";

export const WRAPPER_KINDS = [
    "companion",
    "widget-prop",
    "container-slot",
    "text-anchor",
    "text-paintable",
    "buffer-text",
    "label-text",
] as const;

export type WrapperKind = (typeof WRAPPER_KINDS)[number];

const WRAPPER_KIND_SET: ReadonlySet<string> = new Set(WRAPPER_KINDS);

export const isWrapperKind = (value: unknown): value is WrapperKind =>
    typeof value === "string" && WRAPPER_KIND_SET.has(value);

export const COMPANION_KIND: WrapperKind = "companion";

export const WIDGET_PROP_KIND: WrapperKind = "widget-prop";

export const CONTAINER_SLOT_KIND: WrapperKind = "container-slot";

export const TEXT_ANCHOR_KIND: WrapperKind = "text-anchor";

export const TEXT_PAINTABLE_KIND: WrapperKind = "text-paintable";

export const BUFFER_TEXT_KIND: WrapperKind = "buffer-text";

export const LABEL_TEXT_KIND: WrapperKind = "label-text";

export const resolveGtkxRules = (rules: GtkxRules | undefined): ResolvedGtkxRules => ({
    relationships: rules?.relationships ?? [],
    syntheticProps: rules?.syntheticProps ?? [],
});
