import { isRecord } from "@gtkx/utils";

const WRAPPER_NODE: unique symbol = Symbol.for("gtkx.wrapperNode");

export type WrapperNode = { [WRAPPER_NODE]: true };

export const createWrapperNode = (): WrapperNode => ({ [WRAPPER_NODE]: true });

export const isWrapperNode = (value: unknown): value is WrapperNode => isRecord(value) && WRAPPER_NODE in value;
