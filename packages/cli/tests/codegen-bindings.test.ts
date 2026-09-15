import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";
import { BINDING_CONSUMERS } from "./codegen-binding-consumers.js";
import {
    COMMENT,
    DOCUMENTED_MODULE_CASES,
    fixtureConfig,
    generatedModule,
    HOVER_CASES,
    HOVER_PROBE,
    hoverDoc,
    PURE,
} from "./codegen-helpers.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const STATIC_NARROW_MODULE = "@gtkx/gi/staticnarrow";
const STATIC_NARROW_PROBE = `import { Base, Compact, Derived, Leaf } from "${STATIC_NARROW_MODULE}";

const base: Base = Base.new();
const derived: Derived = Derived.new();
const compact: Compact = Compact.new();
const leaf: Leaf = Leaf.new();
export const parsed: [Base | null, number] = Base.parse("value");

export const values: [string, number, number, number, number] = [
    base.lookup("value"), derived.lookup(1), leaf.lookup(1), compact.measure(), base.measure(1),
];
export const measure: Base["measure"] = compact.measure;
export const inherited: string = compact.lookup("value");
`;
const STATIC_NARROW_REJECTED: Record<string, string> = {
    "runtime-owned-ref.ts": `import { Base } from "${STATIC_NARROW_MODULE}";
export const value = Base.new().ref();
`,
    "runtime-owned-derived-ref.ts": `import { Derived } from "${STATIC_NARROW_MODULE}";
export const value = Derived.new().ref();
`,
    "inherited-signature.ts": `import { Derived } from "${STATIC_NARROW_MODULE}";
export const value = Derived.new().lookup("value");
`,
    "inherited-signature-below.ts": `import { Leaf } from "${STATIC_NARROW_MODULE}";
export const value = Leaf.new().lookup("value");
`,
    "dropped-parameter.ts": `import { Compact } from "${STATIC_NARROW_MODULE}";
export const value = Compact.new().measure(1);
`,
    "nullable-constructor-tuple.ts": `import { Base } from "${STATIC_NARROW_MODULE}";
export const value: [Base, number] = Base.parse("value");
`,
    "omitted-constructor-output.ts": `import { Base } from "${STATIC_NARROW_MODULE}";
export const value: Base | null = Base.parse("value");
`,
};
const MISSING_GIR_CONFIG =
    `export default { applicationId: "com.gtkx.clicodegen", libraries: ${JSON.stringify(["Documented-1.0"])}, ` +
    `girPath: ${JSON.stringify(["/nonexistent"])} };\n`;
const SHARED_IMPORT_CONFIG = `export default {
    applicationId: "org.gtkx.sharedimports",
    libraries: ["Gio-2.0"],
    elements: { config: {
        GObject: { props: { module: "@gtkx/gi/gobject", export: "ObjectConstructorProps" } },
        GSimpleAction: { props: { module: "@gtkx/gi/gobject", export: "ObjectConstructorProps" } },
        GBindingGroup: { props: { module: "react", export: "Attributes" } },
    } },
};`;
const NAMED_PROPS_PROBE = `import type { GBindingGroupProps } from "@gtkx/jsx/gobject";
export const group: GBindingGroupProps = { key: "group" };
`;
const SHARED_IMPORT_PROBE = `import type { GObjectProps } from "@gtkx/jsx/gobject";
import type { GSimpleActionProps } from "@gtkx/jsx/gio";
export const object: GObjectProps = {};
export const action: GSimpleActionProps = { name: "open" };
`;
const REJECTED_NAMED_PROPS_PROBE = `import type { GBindingGroupProps } from "@gtkx/jsx/gobject";
export const group: GBindingGroupProps = { key: {} };
`;

describe("gtkx codegen (libraries the generated types have to escape)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-statics-",
            config: fixtureConfig("StaticNarrow-1.0"),
            files: { "probe.ts": STATIC_NARROW_PROBE, ...STATIC_NARROW_REJECTED },
        });

        state.status = runCli(state.project, ["codegen"]).status;
        isolateTypeConsumer(state.project);
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("accepts narrowed factories and methods through the public namespace", () => {
        expect(state.status).toBe(0);
        expect(typecheckFile(state.project, "probe.ts")).toBe(0);
    });

    it.each(Object.keys(STATIC_NARROW_REJECTED))("rejects an incompatible consumer in %s", (file) => {
        expect(state.status).toBe(0);
        expect(typecheckFile(state.project, file)).not.toBe(0);
    });

    it("escapes reserved bindings and type names without changing GIR acronym casing", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-reserved-",
            config: fixtureConfig("ReservedNames-1.0"),
            files: {
                "probe.ts": `import {
    class_, class__, number_, number__, default_, await_, arguments_, getHTTPStatus,
} from "@gtkx/gi/reservednames";
export const values = [class_.FIRST, class__.FIRST, number_.FIRST, number__.FIRST];
export const invoke = () => {
    default_(class_.FIRST, number_.FIRST);
    await_();
    arguments_();
    return getHTTPStatus();
};
`,
                "rejected.ts": `import { number as NumberType } from "@gtkx/gi/reservednames";
export const value = NumberType.FIRST;
`,
            },
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(typecheckFile(project, "probe.ts")).toBe(0);
        expect(typecheckFile(project, "rejected.ts")).not.toBe(0);
    });
});

describe("gtkx codegen (configured props imports)", () => {
    let project: CliProject;
    let status: number | null;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-codegen-shared-imports-",
            config: SHARED_IMPORT_CONFIG,
            files: {
                "named.ts": NAMED_PROPS_PROBE,
                "shared.ts": SHARED_IMPORT_PROBE,
                "rejected.ts": REJECTED_NAMED_PROPS_PROBE,
            },
        });
        status = runCli(project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("exposes props imported by name from another package", () => {
        expect(status).toBe(0);
        expect(typecheckFile(project, "named.ts")).toBe(0);
    });

    it("combines named props imports with runtime and type-only GI namespaces", () => {
        expect(status).toBe(0);
        expect(typecheckFile(project, "shared.ts")).toBe(0);
    });

    it("rejects values incompatible with the imported props", () => {
        expect(status).toBe(0);
        expect(typecheckFile(project, "rejected.ts")).not.toBe(0);
    });
});

describe("gtkx codegen (where the documentation goes)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-docs-",
            config: fixtureConfig("Documented-1.0"),
            files: { "src/probe.tsx": HOVER_PROBE },
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it.each(DOCUMENTED_MODULE_CASES)(
        "documents $title in its declaration alone",
        ({ store, stem, docs, stripped }) => {
            expect(state.status).toBe(0);
            const declared = generatedModule(state.project, store, `${stem}.d.ts`);
            expect(docs.filter((text) => !declared.includes(text))).toEqual([]);
            expect(stripped.filter((text) => declared.includes(text))).toEqual([]);
            const emitted = generatedModule(state.project, store, `${stem}.js`).split(PURE).join("");
            expect(emitted).not.toMatch(COMMENT);
        },
    );

    it.each(HOVER_CASES)("surfaces the documentation of $title on hover", ({ text, doc, omits }) => {
        expect(state.status).toBe(0);
        const hover = hoverDoc(state.project, join("src", "probe.tsx"), text);
        expect(hover).toContain(doc);
        expect(omits.filter((entry) => hover.includes(entry))).toEqual([]);
    });

    it("fails when the documented library has no GIR file on the search path", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-docs-missing-",
            config: MISSING_GIR_CONFIG,
        });

        expect(runCli(project, ["codegen"]).status).not.toBe(0);
    });
});

describe.each(BINDING_CONSUMERS)("gtkx codegen ($title)", ({ library, accepted, rejected }) => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-bindings-",
            config: fixtureConfig(library),
            files: { ...accepted, ...rejected },
        });
        state.status = runCli(state.project, ["codegen"]).status;
        isolateTypeConsumer(state.project);
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it.each(Object.keys(accepted))("accepts the public consumer in %s", (file) => {
        expect(state.status).toBe(0);
        expect(typecheckFile(state.project, file)).toBe(0);
    });

    it.each(Object.keys(rejected))("rejects the incompatible consumer in %s", (file) => {
        expect(state.status).toBe(0);
        expect(typecheckFile(state.project, file)).not.toBe(0);
    });
});
