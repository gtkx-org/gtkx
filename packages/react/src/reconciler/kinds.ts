export const ELEMENT_KIND = "gtkx:element";

export const PROP_KIND = "gtkx:prop";

export const TEXT_KIND = "gtkx:text";

export const WRAPPER_ELEMENT = "gtkx:wrapper-element";

export type WrapperKind = typeof PROP_KIND | typeof TEXT_KIND | typeof WRAPPER_ELEMENT;

export const isWrapperKind = (kind: string): kind is WrapperKind =>
    kind === PROP_KIND || kind === TEXT_KIND || kind === WRAPPER_ELEMENT;

export type Props = Record<string, unknown>;
