import { describe, expect, it } from "vitest";
import { z } from "zod";
import { configError, rawIssue } from "../src/config-error.js";

const messageFor = (schema: z.ZodType, value: unknown): string => {
    const result = schema.safeParse(value);

    if (result.success) {
        throw new Error("expected the value to be rejected");
    }

    return configError(result.error).message;
};

describe("configError", () => {
    it("renders an unrecognized key with its own path", () => {
        const schema = z.strictObject({ known: z.string().optional() });
        expect(messageFor(schema, { unknown: 1 })).toBe("gtkx.config.ts: `unknown` is not a recognized key");
    });

    it("appends a nested object's unrecognized key to the issue path", () => {
        const schema = z.strictObject({ nested: z.strictObject({ known: z.string().optional() }).optional() });

        expect(messageFor(schema, { nested: { unknown: 1 } })).toBe(
            "gtkx.config.ts: `nested.unknown` is not a recognized key",
        );
    });

    it("renders an unrecognized record key the same way as an unrecognized object key", () => {
        const schema = z.strictObject({ urls: z.partialRecord(z.enum(["homepage"]), z.string()).optional() });

        expect(messageFor(schema, { urls: { bugs: "https://a.b" } })).toBe(
            "gtkx.config.ts: `urls.bugs` is not a recognized key",
        );
    });

    it("keeps the predicate phrasing for a path-qualified issue", () => {
        const schema = z.strictObject({ count: z.int({ error: "must be an integer" }) });
        expect(messageFor(schema, { count: "x" })).toBe("gtkx.config.ts: `count` must be an integer");
    });

    it("prints a standalone issue without a path", () => {
        const schema = z.custom<string>().check((ctx) => {
            ctx.issues.push(rawIssue(ctx.value, [], "invalid `thing`, must be a thing", true));
        });

        expect(messageFor(schema, "x")).toBe("gtkx.config.ts: invalid `thing`, must be a thing");
    });

    it("falls back to a generic message when there are no issues", () => {
        expect(configError(new z.ZodError([])).message).toBe("gtkx.config.ts: invalid configuration");
    });
});
