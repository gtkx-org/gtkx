import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Library } from "../../src/gir/library.js";
import { runCodegen } from "../../src/index.js";
import { storeUnit } from "../helpers/store-unit.js";

const NAMESPACE_OPEN = '<?xml version="1.0"?>\n<repository version="1.2">\n  <namespace name="Bare" version="1.0">\n';
const NAMESPACE_CLOSE = "  </namespace>\n</repository>\n";
const MID_TAG = '<?xml version="1.0"?>\n<repository version="1.2">\n  <namespace name="Bare" ver';
const NO_NAMESPACE = '<?xml version="1.0"?>\n<repository version="1.2"></repository>\n';
const NO_REPOSITORY = '<?xml version="1.0"?>\n<introspection></introspection>\n';
const DECLARES_NOTHING = '    <docsection name="intro"/>\n';

const DECLARES_ONLY_UNINTROSPECTABLE =
    '    <function name="doit" c:identifier="bare_doit" introspectable="0">\n' +
    '      <return-value transfer-ownership="none"><type name="none" c:type="void"/></return-value>\n' +
    "    </function>\n";

const DECLARES_ONLY_UNNAMED = '    <record name="" c:type="BareAnon"/>\n';

const DECLARES_UNRESOLVED_PARENT =
    '    <class name="Thing" parent="Missing" c:symbol-prefix="thing" c:type="BareThing"\n' +
    '        glib:type-name="BareThing" glib:get-type="bare_thing_get_type">\n' +
    "    </class>\n";

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

    it("keeps loading a well-formed namespace", () => {
        expect(() => {
            loadBare(`${NAMESPACE_OPEN}${NAMESPACE_CLOSE}`);
        }).not.toThrow();
    });
});

describe("codegen given a .gir the generated bindings cannot come from", () => {
    let root: string;
    let girDir: string;
    const barePath = (): string => join(girDir, "Bare-1.0.gir");

    const startCodegen = (declarations: string): { run: Promise<unknown>; giStoreDir: string } => {
        writeFileSync(barePath(), `${NAMESPACE_OPEN}${declarations}${NAMESPACE_CLOSE}`);
        const gi = storeUnit(join(root, "node_modules"), "gi");

        return { run: runCodegen({ libraries: ["Bare-1.0"], girPath: [girDir], gi }), giStoreDir: gi.storeDir };
    };

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "gtkx-gir-nothing-"));
        girDir = join(root, "gir");
        mkdirSync(girDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it.each([
        ["declares nothing at all", DECLARES_NOTHING],
        ["declares only what GIR marks as not introspectable", DECLARES_ONLY_UNINTROSPECTABLE],
        ["declares only an entry with no name to export", DECLARES_ONLY_UNNAMED],
    ])("names the file that %s, instead of type-checking a store built from it", async (_case, declarations) => {
        const { run, giStoreDir } = startCodegen(declarations);
        await expect(run).rejects.toThrow(`GIR file at ${barePath()} has nothing to generate`);
        await expect(run).rejects.toThrow("its Bare namespace produces a module with no exports");
        await expect(run).rejects.not.toThrow("Type checking");
        expect(existsSync(`${giStoreDir}.failed`)).toBe(false);
    });

    it("names the file a module whose declarations do not resolve was generated from", async () => {
        const { run, giStoreDir } = startCodegen(DECLARES_UNRESOLVED_PARENT);
        await expect(run).rejects.toThrow("Cannot find name 'Missing'");
        await expect(run).rejects.toThrow(`Generated from ${barePath()}: bare/bare.ts`);
        expect(existsSync(`${giStoreDir}.failed`)).toBe(true);
    });
});
