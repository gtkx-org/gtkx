import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCliOrThrow } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";

const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const CONSUMERS = {
    "callbacks.ts": `import type { Base, Derived, Leaf } from "@gtkx/gi/outputshapes";
export const visitBase = (value: Base): void => value.visit((item) => item + 1);
export const visitDerived = (value: Derived): void => value.visit((item) => item.toUpperCase());
export const visitLeaf = (value: Leaf): void => value.visit((item) => item.toUpperCase());
`,
    "outputs.ts": `import type { Base, Derived } from "@gtkx/gi/outputshapes";
export const readBase = (value: Base): number => value.read();
export const readDerived = (value: Derived): string => value.read();
export const inspectBase = (value: Base): [boolean, number] => value.inspect();
export const inspectDerived = (value: Derived): number => value.inspect();
`,
    "folded-outputs.ts": `import type { Base, Derived, Leaf } from "@gtkx/gi/outputshapes";
export const advanceBase = (value: Base): number => value.advance(1);
export const advanceDerived = (value: Derived): [number, string] => value.advance(1);
export const copyBase = (value: Base): number[] => value.copy();
export const copyDerived = (value: Derived): string[] => value.copy();
export const readLeaf = (value: Leaf): string => value.read();
export const copyLeaf = (value: Leaf): string[] => value.copy();
`,
    "rejected-output.ts": `import type { Derived } from "@gtkx/gi/outputshapes";
export const read = (value: Derived): number => value.read();
`,
    "rejected-callback.ts": `import type { Derived } from "@gtkx/gi/outputshapes";
export const visit = (value: Derived): void => value.visit((item: number) => item + 1);
`,
    "rejected-skipped-return.ts": `import type { Derived } from "@gtkx/gi/outputshapes";
export const inspect = (value: Derived): [boolean, number] => value.inspect();
`,
    "rejected-length-output.ts": `import type { Derived } from "@gtkx/gi/outputshapes";
export const copy = (value: Derived): [string[], number] => value.copy();
`,
};

const typecheck = (project: CliProject, file: string): void => {
    const result = spawnSync(process.execPath, [
        TYPESCRIPT_CLI,
        "--noEmit",
        "--module", "ESNext",
        "--moduleResolution", "Bundler",
        "--skipLibCheck", "false",
        "--strict",
        "--target", "ESNext",
        "--types", "node",
        file,
    ], { cwd: project.root, encoding: "utf8" });

    if (result.status !== 0) {
        throw new Error(`${result.stdout}${result.stderr}`);
    }
};

describe("gtkx codegen inherited output shapes", () => {
    let project: CliProject;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-codegen-analysis-",
            config: fixtureConfig("OutputShapes-1.0"),
            files: CONSUMERS,
        });
        runCliOrThrow(project, ["codegen"]);
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("keeps each class's output and skipped-return contracts", () => {
        expect(() => {
            typecheck(project, "outputs.ts");
        }).not.toThrow();
    });

    it("keeps callback signatures specific to each class", () => {
        expect(() => {
            typecheck(project, "callbacks.ts");
        }).not.toThrow();
    });

    it("folds inout values and array lengths before comparing inherited results", () => {
        expect(() => {
            typecheck(project, "folded-outputs.ts");
        }).not.toThrow();
    });

    it.each([
        "rejected-output.ts", "rejected-callback.ts", "rejected-skipped-return.ts", "rejected-length-output.ts",
    ])(
        "rejects an incompatible result in %s",
        (file) => {
            expect(() => {
                typecheck(project, file);
            }).toThrow();
        },
    );
});

describe("gtkx codegen interface output shapes", () => {
    let project: CliProject;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-codegen-interface-analysis-",
            config: fixtureConfig("OutputInterfaces-1.0"),
            files: {
                "interfaces.ts": `import type { Collector, Filler } from "@gtkx/gi/outputinterfaces";
export const collect = (value: Collector): [boolean, number[]] => value.measure();
export const fill = (value: Filler): [boolean, number[]] => value.measure();
`,
                "classes.ts": `import type { Base, Host, Owned } from "@gtkx/gi/outputinterfaces";
export const base = (value: Base): boolean => value.measure();
export const inherited = (value: Host): boolean => value.measure();
export const own = (value: Owned): boolean => value.measure();
`,
                "rejected.ts": `import type { Collector } from "@gtkx/gi/outputinterfaces";
export const collect = (value: Collector): boolean => value.measure();
`,
            },
        });
        runCliOrThrow(project, ["codegen"]);
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("includes caller-allocated outputs when comparing prerequisite methods", () => {
        expect(() => {
            typecheck(project, "interfaces.ts");
        }).not.toThrow();
    });

    it("preserves class methods that conflict with an implemented interface", () => {
        expect(() => {
            typecheck(project, "classes.ts");
        }).not.toThrow();
    });

    it("rejects an interface result with its allocated outputs missing", () => {
        expect(() => {
            typecheck(project, "rejected.ts");
        }).toThrow();
    });
});

describe("gtkx codegen inherited async signatures", () => {
    let project: CliProject;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-codegen-async-analysis-",
            config: fixtureConfig("AsyncInheritance-1.0"),
            files: {
                "classes.ts": `import type { Base, Derived, Leaf } from "@gtkx/gi/asyncinheritance";
export const base = (value: Base): Promise<number> => value.readAsync();
export const derived = (value: Derived): Promise<string> => value.readAsync();
export const leaf = (value: Leaf): Promise<string> => value.readAsync();
`,
                "finish-outputs.ts": `import type { Base, Derived } from "@gtkx/gi/asyncinheritance";
export const base = (value: Base): Promise<number> => value.inspectAsync();
export const derived = (value: Derived): Promise<[number, string]> => value.inspectAsync();
`,
                "interfaces.ts": `import type { Collector, Host, Owned, Reader } from "@gtkx/gi/asyncinheritance";
export const collect = (value: Collector): Promise<string> => value.readAsync();
export const read = (value: Reader): Promise<string> => value.readAsync();
export const inherited = (value: Host): Promise<number> => value.readAsync();
export const own = (value: Owned): Promise<number> => value.readAsync();
`,
                "interface-ancestor.ts": `import type { Host, HostChild } from "@gtkx/gi/asyncinheritance";
export const inherited = (value: Host): Promise<number> => value.readAsync();
export const own = (value: HostChild): Promise<string> => value.readAsync();
`,
                "interface-fallback.ts": `import type {
    InterfaceHost, InterfaceChild,
} from "@gtkx/gi/asyncinheritance";
export const inherited = (value: InterfaceHost): Promise<string> => value.readAsync();
export const own = (value: InterfaceChild): Promise<number> => value.readAsync();
`,
                "inherited-interface-order.ts": `import type { Middle, MiddleChild } from "@gtkx/gi/asyncinheritance";
export const inherited = (value: Middle): Promise<string> => value.readAsync();
export const own = (value: MiddleChild): Promise<number> => value.readAsync();
`,
                "declared-interface-order.ts": `import type {
    OrderedHost, OrderedChild,
} from "@gtkx/gi/asyncinheritance";
export const inherited = (value: OrderedHost): Promise<string> => value.readAsync();
export const own = (value: OrderedChild): Promise<number> => value.readAsync();
`,
                "rejected.ts": `import type { Derived } from "@gtkx/gi/asyncinheritance";
export const read = (value: Derived): Promise<number> => value.readAsync();
`,
            },
        });
        runCliOrThrow(project, ["codegen"]);
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it.each([
        "classes.ts", "finish-outputs.ts", "interfaces.ts", "interface-ancestor.ts", "interface-fallback.ts",
        "inherited-interface-order.ts", "declared-interface-order.ts",
    ])(
        "preserves finish results in the generated promises in %s",
        (file) => {
            expect(() => {
                typecheck(project, file);
            }).not.toThrow();
        },
    );

    it("rejects an inherited async result from the wrong finish method", () => {
        expect(() => {
            typecheck(project, "rejected.ts");
        }).toThrow();
    });
});

describe("gtkx codegen virtual function output shapes", () => {
    let project: CliProject;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-codegen-vfunc-analysis-",
            config: fixtureConfig("VfuncOutputs-1.0"),
            files: {
                "interfaces.ts": `import type { Counted, Folded } from "@gtkx/gi/vfuncoutputs";
export const folded = (value: Folded): number[] => value.vfuncRead();
export const counted = (value: Counted): [number[], number] => value.vfuncRead();
`,
                "combined.ts": `import type { Combined, Reversed } from "@gtkx/gi/vfuncoutputs";
export const first = (value: Combined): number[] => value.vfuncRead();
export const reversed = (value: Reversed): [number[], number] => value.vfuncRead();
`,
                "rejected.ts": `import type { Combined } from "@gtkx/gi/vfuncoutputs";
export const read = (value: Combined): [number[], number] => value.vfuncRead();
`,
            },
        });
        runCliOrThrow(project, ["codegen"]);
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it.each(["interfaces.ts", "combined.ts"])("preserves virtual function output shapes in %s", (file) => {
        expect(() => {
            typecheck(project, file);
        }).not.toThrow();
    });

    it("rejects an extra tuple element for a folded array length", () => {
        expect(() => {
            typecheck(project, "rejected.ts");
        }).toThrow();
    });
});
