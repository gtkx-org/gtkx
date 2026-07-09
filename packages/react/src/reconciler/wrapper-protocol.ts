export const WRAPPER_NODE_ELEMENT = "__GTKX_WRAPPER_NODE__";

const WRAPPER_KINDS = [
    "lazy-element",
    "object-prop",
    "container-prop",
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

export const OBJECT_PROP_KIND: WrapperKind = "object-prop";

export const CONTAINER_PROP_KIND: WrapperKind = "container-prop";

export const TEXT_ANCHOR_KIND: WrapperKind = "text-anchor";

export const TEXT_PAINTABLE_KIND: WrapperKind = "text-paintable";

export const BUFFER_TEXT_KIND: WrapperKind = "buffer-text";

export const LABEL_TEXT_KIND: WrapperKind = "label-text";
