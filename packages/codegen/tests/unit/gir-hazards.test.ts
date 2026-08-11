import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Library } from "../../src/gir/library.js";
import { generateNamespaceModule } from "../../src/store/gi/pipeline.js";

const FIXTURE_GIR_PATH = [join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "gir")];
const library = Library.load(["Hazard-1.0", "Bare-1.0", "Clash-1.0"], FIXTURE_GIR_PATH);
const twinLibrary = Library.load(["Twin-1.0"], FIXTURE_GIR_PATH);

const sources: Map<string, string> = new Map(
    library.namespaces.values().map((namespace) => [namespace.name, generateNamespaceModule(namespace, library)]),
);

const hazard = String(sources.get("Hazard"));
const bare = String(sources.get("Bare"));
const clash = String(sources.get("Clash"));

const generateTwinModules = (): void => {
    for (const namespace of twinLibrary.namespaces.values()) {
        generateNamespaceModule(namespace, twinLibrary);
    }
};

describe("a namespace whose type names collide with TypeScript keywords", () => {
    it.each([
        ["boolean", "export class boolean_ {"],
        ["enum", "export class enum_ {"],
        ["void", "export class void_ {"],
        ["object", "export class object_ {"],
    ])("suffixes the record named %s", (_name, declaration) => {
        expect(hazard).toContain(declaration);
    });

    it("suffixes again a type name that already carries the suffix", () => {
        expect(hazard).toContain("export class boolean__ {");
    });

    it("suffixes again a value name that already carries the suffix", () => {
        expect(hazard).toContain("export const in_ = 1;");
        expect(hazard).toContain("export const in__ = 2;");
    });

    it("suffixes an alias named after a reserved word", () => {
        expect(hazard).toContain("export type function_ = number;");
    });

    it("leaves a safe type name alone", () => {
        expect(hazard).toContain("export type Offset = number;");
    });

    it("names the companion interfaces after the mapped declaration", () => {
        expect(hazard).toContain("export interface boolean_ConstructorProps {}");
    });

    it("refers to the mapped name from every reference site", () => {
        expect(hazard).toContain("takeBoolean(value: boolean_): void");
        expect(hazard).toContain("wrapperClass: boolean_");
    });

    it.each(["boolean", "enum", "void", "object", "function"])(
        "emits no bare declaration named %s",
        (name) => {
            for (const keyword of ["class", "type", "enum", "interface", "const"]) {
                expect(hazard).not.toContain(`export ${keyword} ${name} `);
            }
        },
    );
});

describe("a namespace with member names that are not identifiers", () => {
    it("prefixes a member whose name starts with a digit", () => {
        expect(hazard).toContain("_2d(width: number): void");
    });

    it("drops a member with an empty name", () => {
        expect(hazard.split("\n").some((line) => line.trimStart().startsWith("("))).toBe(false);
        expect(hazard).not.toContain("hazardScalerResample(getHandle");
    });

    it("declares every enum member once, under a name that is an identifier", () => {
        expect(hazard).toContain("export enum Flavor { FIRST = 0, SECOND = 1, _2ND = 2 }");
    });
});

describe("a namespace that declares something with no name", () => {
    it("declares no enumeration", () => {
        expect(hazard).not.toMatch(/export enum\s+\{/u);
    });

    it("declares no alias", () => {
        expect(hazard).not.toMatch(/export type\s+=/u);
    });

    it("declares no constant", () => {
        expect(hazard).not.toMatch(/export const\s+=/u);
    });
});

describe("a namespace whose functions collide on one exported name", () => {
    it("refuses to emit a module that would declare the name twice", () => {
        expect(generateTwinModules).toThrow(
            "The generated module declares 'init' twice in its value space.",
        );
    });
});

describe("a namespace function whose C identifier carries no symbol prefix", () => {
    it("keeps the exported name and renames the binding it calls", () => {
        expect(hazard).toContain("export function unprefixedHelper(): void {\n    _unprefixedHelper();\n}");
        expect(hazard).toContain('const _unprefixedHelper = t.fn("libhazard.so.1", "unprefixed_helper"');
    });
});

describe("a namespace that declares no shared library", () => {
    it("declares none of its functions", () => {
        expect(bare).not.toContain("export function init");
        expect(bare).not.toContain("export function finalize");
    });

    it("registers no bootstrap call for a function it never declared", () => {
        expect(bare).not.toContain("init();");
        expect(bare).not.toContain("onExit(");
    });

    it("resolves no GType against an empty library name", () => {
        expect(bare).not.toContain("resolveType(\"\"");
        expect(bare).not.toContain("registerWrapperClass(");
    });

    it("still declares the types other namespaces can name", () => {
        expect(bare).toContain("export class Handle {");
    });
});

describe("a namespace whose members shadow what they inherit", () => {
    it("renames a vtable slot that shadows an ancestor slot of another signature", () => {
        expect(clash).toContain("protected vfuncDerivedQuery(direction: number, value: number): boolean");
        expect(clash).toContain('callVfunc(Derived, "vfuncDerivedQuery"');
        expect(clash).toContain("protected vfuncQuery(value: number): boolean");
    });

    it("drops a property accessor an inherited method already answers to", () => {
        expect(clash).not.toContain("get isLive()");
        expect(clash).toContain("isLive(): boolean {");
    });

    it("omits an interface member the class cannot satisfy from the implements clause", () => {
        expect(clash).toContain('export class Derived extends Base implements Omit<Sink, "getItem"');
        expect(clash).toContain('export interface Derived extends Omit<Sink, "getItem"');
    });

    it("renders a type name no loaded namespace declares as unknown", () => {
        expect(clash).toContain("export type Weird = unknown;");
        expect(clash).not.toContain("unsigned long long");
    });
});
