const WRAPPER_NODE: unique symbol = Symbol.for("gtkx.wrapperNode");

export type WrapperNode = { [WRAPPER_NODE]: true };

export const createWrapperNode = (): WrapperNode => ({ [WRAPPER_NODE]: true });

export const isWrapperNode = (value: unknown): value is WrapperNode =>
    typeof value === "object" && value !== null && WRAPPER_NODE in value;
