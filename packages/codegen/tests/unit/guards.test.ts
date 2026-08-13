import { describe, expect, it } from "vitest";
import {
    arrayGuard,
    type FieldGuards,
    hasFields,
    isBoolean,
    isNumber,
    isString,
    optionalGuard,
} from "../../src/guards.js";

type Sentinel = {
    id: string;
    size: number;
    isFresh: boolean;
    tags?: string[];
};

const SENTINEL: Sentinel = { id: "gtk", size: 2, isFresh: true };
const isTags = optionalGuard(arrayGuard(isString));
const GUARDS: FieldGuards<Sentinel> = { id: isString, size: isNumber, isFresh: isBoolean, tags: isTags };

const isSentinel = (value: unknown): value is Sentinel => hasFields<Sentinel>(value, GUARDS);
const hasSentinelFields = (guards: FieldGuards<Sentinel>): boolean => hasFields<Sentinel>(SENTINEL, guards);

describe("hasFields", () => {
    it("accepts a record that carries every declared field", () => {
        expect(isSentinel({ ...SENTINEL, tags: ["gi"] })).toBe(true);
    });

    it("accepts a record that leaves out an optional field", () => {
        expect(isSentinel(SENTINEL)).toBe(true);
    });

    it("accepts a record carrying fields the type never declared", () => {
        expect(isSentinel({ ...SENTINEL, version: "1.0.0" })).toBe(true);
    });

    it("rejects a record that leaves out a required field", () => {
        expect(isSentinel({ id: "gtk", size: 2 })).toBe(false);
    });

    it("rejects a record whose optional field is present and malformed", () => {
        expect(isSentinel({ ...SENTINEL, tags: [7] })).toBe(false);
    });

    it("rejects a value that is not a record", () => {
        expect(isSentinel("gtk")).toBe(false);
    });

    it("rejects an array, which carries none of the declared fields", () => {
        expect(isSentinel([SENTINEL])).toBe(false);
    });
});

describe("field guard records", () => {
    it("requires a guard for every field the type declares", () => {
        // @ts-expect-error a record that leaves `tags` out describes only part of the sentinel
        expect(hasSentinelFields({ id: isString, size: isNumber, isFresh: isBoolean })).toBe(true);
    });

    it("requires a guard that narrows to the declared field type", () => {
        // @ts-expect-error `size` records a number, so a string guard never narrows it
        expect(hasSentinelFields({ id: isString, size: isString, isFresh: isBoolean, tags: isTags })).toBe(false);
    });

    it("requires an optional field's guard to accept a record that leaves it out", () => {
        // @ts-expect-error `tags` is optional, so a guard demanding an array rejects sentinels gtkx wrote
        expect(hasSentinelFields({ id: isString, size: isNumber, isFresh: isBoolean, tags: arrayGuard(isString) }))
            .toBe(false);
    });

    it("refuses an optional guard on a required field", () => {
        // @ts-expect-error `size` is required, so a guard waving an absent value through never narrows it
        expect(hasSentinelFields({ id: isString, size: optionalGuard(isNumber), isFresh: isBoolean, tags: isTags }))
            .toBe(true);
    });
});
