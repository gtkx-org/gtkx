import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Library } from "../../src/gir/library.js";
import { runCodegen } from "../../src/index.js";
import { storeUnit } from "../helpers/store-unit.js";

const NAMESPACE_OPEN = '<?xml version="1.0"?>\n<repository version="1.2">\n  <namespace name="Bare" version="1.0">\n';
const MID_TAG = '<?xml version="1.0"?>\n<repository version="1.2">\n  <namespace name="Bare" ver';
const NO_NAMESPACE = '<?xml version="1.0"?>\n<repository version="1.2"></repository>\n';
const NO_REPOSITORY = '<?xml version="1.0"?>\n<introspection></introspection>\n';
const NO_DECLARATIONS = `${NAMESPACE_OPEN}    <docsection name="intro"/>\n  </namespace>\n</repository>\n`;

const DECLARATION =
    '    <constant name="LIMIT" value="1" c:type="BARE_LIMIT">\n' +
    '      <type name="gint" c:type="gint"/>\n' +
    "    </constant>\n";

const POPULATED = `${NAMESPACE_OPEN}${DECLARATION}  </namespace>\n</repository>\n`;

describe("a malformed .gir on the search path", () => {
    let girDir: string;
    const barePath = (): string => join(girDir, "Bare-1.0.gir");

    const loadBare = (contents: string): void => {
        writeFileSync(barePath(), contents);
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
        }).toThrow(`The GIR file at ${barePath()} is not well-formed XML`);
    });

    it("rejects a document truncated inside a tag, naming the file instead of a byte offset", () => {
        expect(() => {
            loadBare(MID_TAG);
        }).toThrow(`The GIR file at ${barePath()} is not well-formed XML`);
    });

    it("names the file whose repository declares no namespace", () => {
        expect(() => {
            loadBare(NO_NAMESPACE);
        }).toThrow(`GIR file at ${barePath()} has no <namespace> child`);
    });

    it("names the file that has no repository root", () => {
        expect(() => {
            loadBare(NO_REPOSITORY);
        }).toThrow(`GIR file at ${barePath()} has no <repository> root`);
    });

    it("names the file whose namespace declares nothing to generate from", () => {
        expect(() => {
            loadBare(NO_DECLARATIONS);
        }).toThrow(`GIR file at ${barePath()} declares nothing in its <namespace>`);
    });

    it("keeps loading a well-formed namespace", () => {
        expect(() => {
            loadBare(POPULATED);
        }).not.toThrow();
    });
});

describe("codegen given a .gir whose namespace declares nothing", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "gtkx-gir-empty-ns-"));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("names the offending file instead of type-checking a store generated from it", async () => {
        const girDir = join(root, "gir");
        mkdirSync(girDir, { recursive: true });
        const file = join(girDir, "Bare-1.0.gir");
        writeFileSync(file, NO_DECLARATIONS);
        const gi = storeUnit(join(root, "node_modules"), "gi");
        const run = runCodegen({ libraries: ["Bare-1.0"], girPath: [girDir], gi });
        await expect(run).rejects.toThrow(`GIR file at ${file} declares nothing in its <namespace>`);
        await expect(run).rejects.not.toThrow("is not a module");
        expect(existsSync(gi.storeDir)).toBe(false);
    });
});
