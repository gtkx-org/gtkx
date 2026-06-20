export const WRAPPER_ELEMENT: unique symbol = Symbol.for("gtkx.wrapperElement");

export type WrapperElement = { [WRAPPER_ELEMENT]: true };

export const createWrapperElement = (): WrapperElement => ({ [WRAPPER_ELEMENT]: true });

export const isWrapperElement = (value: unknown): value is WrapperElement =>
    typeof value === "object" && value !== null && WRAPPER_ELEMENT in value;
