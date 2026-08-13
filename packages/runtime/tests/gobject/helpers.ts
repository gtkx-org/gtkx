import { Value } from "@gtkx/gi/gobject";
import { expect } from "vitest";

type ErrorClass = new (...args: never[]) => Error;

const names = { next: 0 };

const uniqueName = (prefix: string): string => {
    names.next += 1;

    return `${prefix}_${String(process.pid)}_${String(names.next)}`;
};

const thrownBy = (write: () => unknown): unknown => {
    try {
        write();
    } catch (error) {
        return error;
    }

    return undefined;
};

const expectThrown = (write: () => unknown, kind: ErrorClass, message: RegExp | string): void => {
    const thrown = thrownBy(write);
    expect(thrown).toBeInstanceOf(kind);
    expect((thrown as Error).message).toMatch(message);
};

const valueOfType = (type: bigint): Value => {
    const value = new Value();
    value.init(type);

    return value;
};

export { type ErrorClass, expectThrown, thrownBy, uniqueName, valueOfType };
