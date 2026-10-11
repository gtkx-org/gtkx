import type { Descriptor } from "./descriptor-types.js";
import type { Descriptor as NativeDescriptor } from "./native.js";

type NumericKind =
    | "int8"
    | "uint8"
    | "int16"
    | "uint16"
    | "int32"
    | "uint32"
    | "int64"
    | "uint64"
    | "bigint64"
    | "biguint64"
    | "float32"
    | "float64";
type NumericDescriptor = Extract<Descriptor, { kind: NumericKind }>;
type NumericPlan = {
    abi: NativeDescriptor;
    encode: (value: unknown) => unknown;
    decode: (value: unknown) => unknown;
};

const exactLimit = 2 ** 53;
const float32Maximum = (2 - 2 ** -23) * 2 ** 127;
const integerRanges = {
    int8: [-128, 127],
    uint8: [0, 255],
    int16: [-32768, 32767],
    uint16: [0, 65535],
    int32: [-(2 ** 31), 2 ** 31 - 1],
    uint32: [0, 2 ** 32 - 1],
    int64: [-exactLimit, exactLimit],
    uint64: [0, exactLimit],
} as const;

const integer = (value: unknown, kind: keyof typeof integerRanges): number => {
    if (typeof value !== "number") {
        throw new TypeError(`Expected a Number for ${kind}`);
    }
    if (!Number.isFinite(value)) {
        throw new RangeError(`Value ${value} is not finite, ${kind} expects a whole number`);
    }
    if (!Number.isInteger(value)) {
        throw new RangeError(`Value ${value} is not an integer, ${kind} expects a whole number`);
    }
    const [minimum, maximum] = integerRanges[kind];
    if (value < minimum || value > maximum) {
        throw new RangeError(`Value ${value} is out of range for ${kind} [${minimum}, ${maximum}]`);
    }
    return value;
};

const exactNumber = (value: unknown): number => {
    if (typeof value !== "bigint") {
        throw new TypeError("Expected an exact native integer");
    }
    if (value < -9007199254740992n || value > 9007199254740992n) {
        throw new RangeError(
            `Value ${value} exceeds the 2^53 range JavaScript numbers represent exactly; use a bigint descriptor`,
        );
    }
    return Number(value);
};

const bigInteger = (value: unknown, signed: boolean): bigint => {
    const encoded = typeof value === "number" ? BigInt(integer(value, signed ? "int64" : "uint64")) : value;
    if (typeof encoded !== "bigint") {
        throw new TypeError("Expected an integer number within the exact 2^53 range or a bigint");
    }
    const minimum = signed ? -(2n ** 63n) : 0n;
    const maximum = signed ? 2n ** 63n - 1n : 2n ** 64n - 1n;
    if (encoded < minimum || encoded > maximum) {
        throw new RangeError(`Value ${encoded} is out of range for ${signed ? "bigint64" : "biguint64"}`);
    }
    return encoded;
};

const numericPlan = (descriptor: NumericDescriptor): NumericPlan => {
    const { kind } = descriptor;
    if (kind === "int64" || kind === "uint64") {
        const abi: NativeDescriptor = {
            kind: kind === "int64" ? "bigint64" : "biguint64",
            isDirectWord: true,
        };
        return { abi, encode: (value: unknown) => BigInt(integer(value, kind)), decode: exactNumber };
    }
    if (kind === "bigint64" || kind === "biguint64") {
        const abi: NativeDescriptor = { kind, isDirectWord: false };
        return {
            abi,
            encode: (value: unknown) => bigInteger(value, kind === "bigint64"),
            decode: (value: unknown) => value,
        };
    }
    if (kind === "float32" || kind === "float64") {
        return {
            abi: descriptor,
            encode(value: unknown) {
                if (typeof value !== "number") {
                    throw new TypeError(`Expected a Number for ${kind}`);
                }
                if (kind === "float32" && Number.isFinite(value) && Math.abs(value) > float32Maximum) {
                    throw new RangeError(`Value ${value} is out of range for f32`);
                }
                return value;
            },
            decode: (value: unknown) => value,
        };
    }
    return { abi: descriptor, encode: (value: unknown) => integer(value, kind), decode: (value: unknown) => value };
};

export { numericPlan };
