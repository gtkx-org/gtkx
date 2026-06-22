const ROOT_ELEMENT: unique symbol = Symbol.for("gtkx.rootElement");

export type RootElement = { [ROOT_ELEMENT]: true };

export const createRootElement = (): RootElement => ({ [ROOT_ELEMENT]: true });

export const isRootElement = (value: unknown): value is RootElement =>
    typeof value === "object" && value !== null && ROOT_ELEMENT in value;
