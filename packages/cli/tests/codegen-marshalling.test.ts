import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import {
    fixtureConfig,
    generatedModule,
    VALUE_PARAMETER_BINDINGS,
    VALUE_PARAMETER_DECLARATIONS,
} from "./codegen-helpers.js";

type ExpectedOutput = { bindings: string[]; declarations: string[] };

const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const SIDE_CALLBACK_PROBE = `import type { Job, ProgressCallback } from "@gtkx/gi/asyncpair";

export const load = (job: Job, progress: ProgressCallback): Promise<boolean>[] => [
    job.loadAsync(),
    job.loadAsync(null, progress),
];

export const transform = (job: Job): void => {
    job.transformAsync((value) => value, () => undefined);
};
`;

const typecheckProject = (project: { root: string }): void => {
    execFileSync(
        process.execPath,
        [
            TYPESCRIPT_CLI,
            "--noEmit",
            "--module",
            "NodeNext",
            "--moduleResolution",
            "NodeNext",
            "--skipLibCheck",
            "--strict",
            "--target",
            "ESNext",
            "probe.ts",
        ],
        { cwd: project.root, stdio: "pipe" },
    );
};

const evaluateProject = (project: { root: string }, source: string): string =>
    execFileSync(
        process.execPath,
        ["--conditions=source", "--import=tsx", "--input-type=module", "--eval", source],
        { cwd: project.root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

const expectGenerated = (library: string, namespace: string, expected: ExpectedOutput): void => {
    using project = createCliProject({
        prefix: `gtkx-cli-codegen-${namespace}-`,
        config: fixtureConfig(library),
    });

    expect(runCli(project, ["codegen"]).status).toBe(0);
    const declarations = generatedModule(project, "gi", namespace, `${namespace}.d.ts`);
    const bindings = generatedModule(project, "gi", namespace, `${namespace}.js`);
    expect(expected.declarations.filter((text) => !declarations.includes(text))).toEqual([]);
    expect(expected.bindings.filter((text) => !bindings.includes(text))).toEqual([]);
};

describe("gtkx codegen marshalling", () => {
    it("represents byte sequences as typed arrays", () => {
        expectGenerated("ByteSeq-1.0", "byteseq", {
            declarations: [
                "readSized(): Uint8Array",
                "readByteArray(): Uint8Array",
                "writeSized(data: Uint8Array | number[]): void",
                "readNumbers(): number[]",
            ],
            bindings: ["isBytes: true", "t.byteArray("],
        });
    });

    it("accepts JavaScript values and unwraps returned GValues", () => {
        expectGenerated("ValueBox-1.0", "valuebox", {
            declarations: [
                ...VALUE_PARAMETER_DECLARATIONS,
                "peek(): unknown",
                "fill(): [boolean, unknown]",
            ],
            bindings: [...VALUE_PARAMETER_BINDINGS, "isReturnUnpacked: true", "isUnpacked: true"],
        });
    });

    it("trims the leading success value from finish results", () => {
        expectGenerated("AsyncPair-1.0", "asyncpair", {
            declarations: [
                "runAsync(): Promise<[string, number]>",
                "probeAsync(): Promise<boolean>",
            ],
            bindings: ["promisify(asyncPairJobRunAsync, trimFinish(this.runFinish.bind(this))"],
        });
    });

    it("exposes supported side callbacks through the generated API", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-async-side-callback-",
            config: fixtureConfig("AsyncPair-1.0"),
            files: { "probe.ts": SIDE_CALLBACK_PROBE },
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(() => {
            typecheckProject(project);
        }).not.toThrow();
    });

    it("mutates caller-allocated inout records without returning them again", () => {
        expectGenerated("InoutBox-1.0", "inoutbox", {
            declarations: [
                "step(spot: Spot): boolean",
                "recenter(spot: Spot): void",
                "advance(offset: number): [boolean, number]",
                "locate(spot: Spot): [boolean, string]",
            ],
            bindings: [
                'direction: "inout", isCallerAllocated: true, isConsumed: true, isRequired: true }',
                't.int32, direction: "inout", isRequired: true }',
            ],
        });
    });

    it("exposes the factory for objects that require initialization", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-initable-factory-",
            config: fixtureConfig("InitableOnly-1.0"),
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        const source = `import { DBusProxy } from "@gtkx/gi/gio";
process.stdout.write(typeof DBusProxy.newForBusSync);`;
        expect(evaluateProject(project, source)).toBe("function");
    });

    it("rejects direct construction for objects that require initialization", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-initable-guard-",
            config: fixtureConfig("InitableOnly-1.0"),
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        const source = `import { DBusProxy } from "@gtkx/gi/gio";
new DBusProxy();`;
        expect(() => evaluateProject(project, source)).toThrow();
    });
});
