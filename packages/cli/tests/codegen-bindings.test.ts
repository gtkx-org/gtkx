import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
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
describe("gtkx codegen (libraries the generated types have to escape)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "", tmpDir: "" },
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
