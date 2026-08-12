import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Library } from "../../src/gir/library.js";

const NAMESPACE_OPEN = '<?xml version="1.0"?>\n<repository version="1.2">\n  <namespace name="Bare" version="1.0">\n';
const MID_TAG = '<?xml version="1.0"?>\n<repository version="1.2">\n  <namespace name="Bare" ver';
const NO_NAMESPACE = '<?xml version="1.0"?>\n<repository version="1.2"></repository>\n';
const NO_REPOSITORY = '<?xml version="1.0"?>\n<introspection></introspection>\n';

describe("a malformed .gir on the search path", () => {
    let girDir: string;

    const loadBare = (contents: string): void => {
        writeFileSync(join(girDir, "Bare-1.0.gir"), contents);
        Library.load(["Bare-1.0"], [girDir]);
    };

    beforeEach(() => {
        girDir = mkdtempSync(join(tmpdir(), "gtkx-gir-malformed-"));
    });

    afterEach(() => {
        rmSync(girDir, { recursive: true, force: true });
    });

    it("rejects a document that ends before its namespace closes, naming the file", () => {
        expect(() => {
            loadBare(NAMESPACE_OPEN);
        }).toThrow(`The GIR file at ${join(girDir, "Bare-1.0.gir")} is not well-formed XML`);
    });

    it("rejects a document truncated inside a tag, naming the file instead of a byte offset", () => {
        expect(() => {
            loadBare(MID_TAG);
        }).toThrow(`The GIR file at ${join(girDir, "Bare-1.0.gir")} is not well-formed XML`);
    });

    it("names the file whose repository declares no namespace", () => {
        expect(() => {
            loadBare(NO_NAMESPACE);
        }).toThrow(`GIR file at ${join(girDir, "Bare-1.0.gir")} has no <namespace> child`);
    });

    it("names the file that has no repository root", () => {
        expect(() => {
            loadBare(NO_REPOSITORY);
        }).toThrow(`GIR file at ${join(girDir, "Bare-1.0.gir")} has no <repository> root`);
    });

    it("keeps loading a well-formed namespace", () => {
        expect(() => {
            loadBare(`${NAMESPACE_OPEN}  </namespace>\n</repository>\n`);
        }).not.toThrow();
    });
});
