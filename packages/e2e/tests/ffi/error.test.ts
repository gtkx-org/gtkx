import { inspect } from "node:util";
import { getHandle } from "@gtkx/ffi";
import { checkError, createErrorDomain } from "@gtkx/ffi/internal";
import { FileError, Error as GError, quarkFromString } from "@gtkx/gi/glib";
import { describe, expect, it } from "vitest";

const FILE_ERROR_DOMAIN = 0xbe1;
const FILE_ERROR_NOENT = 5;

const gerrorIn = (domain: number): GError => GError.newLiteral(domain, FILE_ERROR_NOENT, "missing file");

describe("checkError", () => {
    it("does nothing when the error ref is empty", () => {
        expect(() => checkError({ value: null })).not.toThrow();
    });

    it("throws the raw GError when the ref is populated", () => {
        const ref = { value: getHandle(gerrorIn(FILE_ERROR_DOMAIN)) };

        let thrown: unknown;
        try {
            checkError(ref);
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(GError);
    });

    it("surfaces the GError message, domain, and code on the thrown value", () => {
        const ref = { value: getHandle(gerrorIn(FILE_ERROR_DOMAIN)) };

        let thrown: GError | undefined;
        try {
            checkError(ref);
        } catch (error) {
            if (error instanceof GError) thrown = error;
        }

        expect(thrown?.message).toBe("missing file");
        expect(thrown?.domain).toBe(FILE_ERROR_DOMAIN);
        expect(thrown?.code).toBe(FILE_ERROR_NOENT);
    });

    it("throws a genuine Error subclass named GLib.Error", () => {
        const ref = { value: getHandle(gerrorIn(FILE_ERROR_DOMAIN)) };

        let thrown: unknown;
        try {
            checkError(ref);
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).name).toBe("GLib.Error");
    });

    it("renders its message when inspected instead of an empty object", () => {
        const ref = { value: getHandle(gerrorIn(FILE_ERROR_DOMAIN)) };

        let thrown: unknown;
        try {
            checkError(ref);
        } catch (error) {
            thrown = error;
        }

        expect(String(thrown)).toContain("missing file");
        expect(inspect(thrown)).toContain("missing file");
    });

    it("attaches a stack trace pointing past checkError", () => {
        const ref = { value: getHandle(gerrorIn(FILE_ERROR_DOMAIN)) };

        let stack: string | undefined;
        try {
            checkError(ref);
        } catch (error) {
            if (typeof error === "object" && error !== null && "stack" in error && typeof error.stack === "string") {
                stack = error.stack;
            }
        }

        expect(typeof stack).toBe("string");
        expect(stack ?? "").not.toContain("at checkError");
    });
});

describe("createErrorDomain", () => {
    it("exposes the enum members", () => {
        const domain = createErrorDomain(() => FILE_ERROR_DOMAIN, { NOENT: FILE_ERROR_NOENT });

        expect(domain.NOENT).toBe(FILE_ERROR_NOENT);
    });

    it("matches a GError from the same domain via instanceof", () => {
        const domain = createErrorDomain(() => FILE_ERROR_DOMAIN, { NOENT: FILE_ERROR_NOENT });

        expect(gerrorIn(FILE_ERROR_DOMAIN) instanceof domain).toBe(true);
    });

    it("rejects a GError from a different domain", () => {
        const domain = createErrorDomain(() => FILE_ERROR_DOMAIN, { NOENT: FILE_ERROR_NOENT });

        expect(gerrorIn(FILE_ERROR_DOMAIN + 1) instanceof domain).toBe(false);
    });

    it("rejects values that are not a GError", () => {
        const domain = createErrorDomain(() => FILE_ERROR_DOMAIN, { NOENT: FILE_ERROR_NOENT });

        expect(new Error("plain") instanceof domain).toBe(false);
    });

    it("matches a generated error-domain enum by its GLib quark", () => {
        const gerror = GError.newLiteral(quarkFromString("g-file-error-quark"), FileError.NOENT, "missing file");

        expect(gerror instanceof FileError).toBe(true);
    });
});
