import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type PackageManifest, readPackageManifest } from "../../../src/deploy/settings/package-manifest.js";

const state = { root: "" };

const ALL_NULL: PackageManifest = {
    name: null,
    version: null,
    description: null,
    license: null,
    homepage: null,
    author: { name: null, email: null },
};

const readWritten = (contents: string): PackageManifest => {
    writeFileSync(join(state.root, "package.json"), contents);

    return readPackageManifest(state.root);
};

const readFields = (fields: Record<string, unknown>): PackageManifest => readWritten(JSON.stringify(fields));
const readAuthor = (author: unknown): PackageManifest["author"] => readFields({ author }).author;

beforeEach(() => {
    state.root = mkdtempSync(join(tmpdir(), "gtkx-package-manifest-"));
});

afterEach(() => {
    rmSync(state.root, { recursive: true, force: true });
});

describe("readPackageManifest", () => {
    it("reads the name, version, description, license and homepage", () => {
        const manifest = readFields({
            name: "gtkx-tutorial",
            version: "1.0.0",
            description: "Tasks app from the GTKX tutorial",
            license: "MPL-2.0",
            homepage: "https://gtkx.dev",
        });

        expect(manifest).toEqual({
            name: "gtkx-tutorial",
            version: "1.0.0",
            description: "Tasks app from the GTKX tutorial",
            license: "MPL-2.0",
            homepage: "https://gtkx.dev",
            author: { name: null, email: null },
        });
    });

    it("trims the surrounding whitespace off every field", () => {
        expect(readFields({ name: "  gtkx-tutorial\n", license: "\tMPL-2.0 " })).toMatchObject({
            name: "gtkx-tutorial",
            license: "MPL-2.0",
        });
    });
});

describe("readPackageManifest with empty fields", () => {
    it("turns a missing field into null", () => {
        expect(readFields({ name: "gtkx-tutorial" })).toMatchObject({ version: null, homepage: null });
    });

    it("turns a whitespace-only field into null", () => {
        const manifest = readFields({ name: " ".repeat(3), description: "\n\t" });
        expect(manifest).toMatchObject({ name: null, description: null });
    });

    it("turns an empty field into null", () => {
        expect(readFields({ license: "" }).license).toBeNull();
    });

    it("turns a field that is not a string into null", () => {
        expect(readFields({ version: 3, name: ["gtkx"], homepage: null })).toMatchObject({
            version: null,
            name: null,
            homepage: null,
        });
    });
});

describe("readPackageManifest with an author string", () => {
    it("parses the name and the email out of the string form", () => {
        expect(readAuthor("GTKX <hello@gtkx.dev> (https://gtkx.dev)")).toEqual({
            name: "GTKX",
            email: "hello@gtkx.dev",
        });
    });

    it("parses a string form that carries no url", () => {
        expect(readAuthor("GTKX <hello@gtkx.dev>")).toEqual({ name: "GTKX", email: "hello@gtkx.dev" });
    });

    it("leaves the email null when the author string has no email", () => {
        expect(readAuthor("GTKX")).toEqual({ name: "GTKX", email: null });
    });

    it("drops the url from an author string that has no email", () => {
        expect(readAuthor("GTKX (https://gtkx.dev)")).toEqual({ name: "GTKX", email: null });
    });

    it("leaves the name null when the author string is only an email", () => {
        expect(readAuthor("<hello@gtkx.dev>")).toEqual({ name: null, email: "hello@gtkx.dev" });
    });

    it("leaves the email null when the angle brackets are empty", () => {
        expect(readAuthor("GTKX <>")).toEqual({ name: "GTKX", email: null });
    });

    it("leaves both null when the author string is empty", () => {
        expect(readAuthor("")).toEqual({ name: null, email: null });
    });

    it("leaves both null when the author string is whitespace only", () => {
        expect(readAuthor(" ".repeat(3))).toEqual({ name: null, email: null });
    });
});

describe("readPackageManifest with an author object", () => {
    it("reads the name and the email out of the object form", () => {
        expect(readAuthor({ name: "GTKX", email: "hello@gtkx.dev" })).toEqual({
            name: "GTKX",
            email: "hello@gtkx.dev",
        });
    });

    it("ignores the url field of the object form", () => {
        expect(readAuthor({ name: "GTKX", url: "https://gtkx.dev" })).toEqual({ name: "GTKX", email: null });
    });

    it("turns whitespace-only object fields into null", () => {
        expect(readAuthor({ name: " ", email: "\t" })).toEqual({ name: null, email: null });
    });

    it("turns object fields that are not strings into null", () => {
        expect(readAuthor({ name: 7, email: false })).toEqual({ name: null, email: null });
    });

    it("leaves both null when the author is a number", () => {
        expect(readAuthor(4)).toEqual({ name: null, email: null });
    });

    it("leaves both null when the author is missing", () => {
        expect(readAuthor(undefined)).toEqual({ name: null, email: null });
    });

    it("leaves both null when the author is null", () => {
        expect(readAuthor(null)).toEqual({ name: null, email: null });
    });
});

describe("readPackageManifest with an unreadable manifest", () => {
    it("returns an all-null manifest when there is no package.json", () => {
        expect(readPackageManifest(state.root)).toEqual(ALL_NULL);
    });

    it("returns an all-null manifest when the root does not exist", () => {
        expect(readPackageManifest(join(state.root, "missing"))).toEqual(ALL_NULL);
    });

    it("returns an all-null manifest when the json is malformed", () => {
        expect(readWritten("{ not json")).toEqual(ALL_NULL);
    });

    it("returns an all-null manifest when the json is empty", () => {
        expect(readWritten("")).toEqual(ALL_NULL);
    });

    it("returns an all-null manifest when the json is a string", () => {
        expect(readWritten("\"gtkx-tutorial\"")).toEqual(ALL_NULL);
    });

    it("returns an all-null manifest when the json is a number", () => {
        expect(readWritten("12")).toEqual(ALL_NULL);
    });

    it("returns an all-null manifest when the json is an array", () => {
        expect(readWritten("[\"gtkx-tutorial\"]")).toEqual(ALL_NULL);
    });
});
