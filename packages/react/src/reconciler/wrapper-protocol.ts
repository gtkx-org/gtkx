export const WRAPPER_NODE_ELEMENT = "__GTKX_WRAPPER_NODE__";

const WRAPPER_KINDS = [
    "lazy-element",
    "widget-prop",
    "container-slot",
    "text-anchor",
    "text-paintable",
    "buffer-text",
    "label-text",
] as const;

export type WrapperKind = (typeof WRAPPER_KINDS)[number];

const WRAPPER_KIND_SET: Set<string> = new Set(WRAPPER_KINDS);

export const isWrapperKind = (value: unknown): value is WrapperKind =>
    typeof value === "string" && WRAPPER_KIND_SET.has(value);

export const LAZY_ELEMENT_KIND: WrapperKind = "lazy-element";

export const WIDGET_PROP_KIND: WrapperKind = "widget-prop";

export const CONTAINER_SLOT_KIND: WrapperKind = "container-slot";

export const TEXT_ANCHOR_KIND: WrapperKind = "text-anchor";

export const TEXT_PAINTABLE_KIND: WrapperKind = "text-paintable";

export const BUFFER_TEXT_KIND: WrapperKind = "buffer-text";

export const LABEL_TEXT_KIND: WrapperKind = "label-text";
