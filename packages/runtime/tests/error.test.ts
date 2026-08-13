import { FileError, Error as GError, quarkFromString } from "@gtkx/gi/glib";
import { getHandle } from "@gtkx/runtime";
import { checkError, createErrorDomain } from "@gtkx/runtime/internal";
import { inspect } from "node:util";
import { describe, expect, it } from "vitest";

const FILE_ERROR_DOMAIN = 0xB_E1;
const FILE_ERROR_NOENT = 5;

const gerrorIn = (domain: number): GError => GError.newLiteral(domain, FILE_ERROR_NOENT, "missing file");

const catchCheckError = (): unknown => {
    const ref = { value: getHandle(gerrorIn(FILE_ERROR_DOMAIN)) };
    let thrown: unknown;

    try {
        checkError(ref);
    } catch (error) {
        thrown = error;
    }

    return thrown;
};

const getStack = (thrown: unknown): string | undefined => {
    if (typeof thrown === "object" && thrown !== null && "stack" in thrown && typeof thrown.stack === "string") {
        return thrown.stack;
    }

    return undefined;
};

describe("checkError", () => {
    it("does nothing when the error ref is empty", () => {
        expect(() => {
            checkError({ value: null });
        }).not.toThrow();
    });

    it("throws the raw GError when the ref is populated", () => {
        const thrown = catchCheckError();
        expect(thrown).toBeInstanceOf(GError);
    });

    it("surfaces the GError message, domain, and code on the thrown value", () => {
        const caught = catchCheckError();
        const thrown = caught instanceof GError ? caught : undefined;
        expect(thrown?.message).toBe("missing file");
        expect(thrown?.domain).toBe(FILE_ERROR_DOMAIN);
        expect(thrown?.code).toBe(FILE_ERROR_NOENT);
    });

    it("throws an Error subclass named GLib.Error", () => {
        const thrown = catchCheckError();
        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).name).toBe("GLib.Error");
    });

    it("renders its message when inspected instead of an empty object", () => {
        const thrown = catchCheckError();
        expect(String(thrown)).toContain("missing file");
        expect(inspect(thrown)).toContain("missing file");
    });

    it("attaches a stack trace pointing past checkError", () => {
        const stack = getStack(catchCheckError());
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
        expect(gerrorIn(FILE_ERROR_DOMAIN)).toBeInstanceOf(domain);
    });

    it("rejects a GError from a different domain", () => {
        const domain = createErrorDomain(() => FILE_ERROR_DOMAIN, { NOENT: FILE_ERROR_NOENT });
        expect(gerrorIn(FILE_ERROR_DOMAIN + 1)).not.toBeInstanceOf(domain);
    });

    it("rejects values that are not a GError", () => {
        const domain = createErrorDomain(() => FILE_ERROR_DOMAIN, { NOENT: FILE_ERROR_NOENT });
        expect(new Error("plain")).not.toBeInstanceOf(domain);
    });

    it("matches a generated error-domain enum by its GLib quark", () => {
        const gerror = GError.newLiteral(quarkFromString("g-file-error-quark"), FileError.NOENT, "missing file");
        expect(gerror).toBeInstanceOf(FileError);
    });
});
