import { FileError, Error as GError, quarkFromString } from "@gtkx/gi/glib";
import { createErrorDomain } from "@gtkx/runtime/internal";
import { describe, expect, it } from "vitest";

const FILE_ERROR_DOMAIN = 0xB_E1;
const FILE_ERROR_NOENT = 5;

const gerrorIn = (domain: number): GError => GError.newLiteral(domain, FILE_ERROR_NOENT, "missing file");

describe("createErrorDomain", () => {
    it("exposes enum members and matches errors from its domain", () => {
        const domain = createErrorDomain(() => FILE_ERROR_DOMAIN, { NOENT: FILE_ERROR_NOENT });
        expect(domain.NOENT).toBe(FILE_ERROR_NOENT);
        expect(gerrorIn(FILE_ERROR_DOMAIN)).toBeInstanceOf(domain);
    });

    it("rejects values outside its domain", () => {
        const domain = createErrorDomain(() => FILE_ERROR_DOMAIN, { NOENT: FILE_ERROR_NOENT });
        expect(gerrorIn(FILE_ERROR_DOMAIN + 1)).not.toBeInstanceOf(domain);
        expect(new Error("plain")).not.toBeInstanceOf(domain);
    });

    it("matches a generated error-domain enum by its GLib quark", () => {
        const gerror = GError.newLiteral(quarkFromString("g-file-error-quark"), FileError.NOENT, "missing file");
        expect(gerror).toBeInstanceOf(FileError);
    });
});
