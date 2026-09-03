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
const GUDEV_CONFIG = `export default {
    applicationId: "com.gtkx.gudevprobe",
    libraries: ["GUdev-1.0"],
};
`;
const GIO_CONFIG = `export default {
    applicationId: "com.gtkx.gioprobe",
    libraries: ["Gio-2.0"],
};
`;
const GIO_TYPE_PROBE = `import type * as Gio from "@gtkx/gi/gio";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

const signatures: [
    Expect<
        Equal<
            Parameters<Gio.Socket["connect"]>,
            [address: Gio.SocketAddress, cancellable: Gio.Cancellable | null]
        >
    >,
    Expect<Equal<ReturnType<Gio.Socket["connect"]>, boolean>>,
] = [true, true];
`;
const GIO_TYPE_ERRORS = {
    "subprocess.ts": `import * as Gio from "@gtkx/gi/gio";
Gio.Subprocess.newv(["/usr/bin/true"], Gio.SubprocessFlags.NONE);
`,
    "zero-argument-collision.ts": `import * as Gio from "@gtkx/gi/gio";
declare const socket: Gio.Socket;
socket.connect();
`,
    "missing-signal-argument.ts": `import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
declare const socket: Gio.Socket;
GObject.signalEmit(socket, "notify::blocking");
`,
    "wrong-signal-argument.ts": `import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
declare const socket: Gio.Socket;
GObject.signalEmit(socket, "notify::blocking", "wrong");
`,
    "unknown-signal.ts": `import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
declare const socket: Gio.Socket;
GObject.signalEmit(socket, "not-real", 123);
`,
};
const GUDEV_PROPERTY_PROBE = `import * as GUdev from "@gtkx/gi/gudev";

const client = GUdev.Client.new(null);
const device = client.queryBySysfsPath("/sys/devices/virtual/net/lo");

if (device === null) {
    throw new Error("loopback device is unavailable");
}

const value = device.getProperty("INTERFACE");

if (value !== "lo") {
    throw new Error("loopback device has no interface property");
}
`;
const SIDE_CALLBACK_PROBE = `import type { Job, ProgressCallback } from "@gtkx/gi/asyncpair";

export const load = (job: Job, progress: ProgressCallback): Promise<boolean>[] => [
    job.loadAsync(),
    job.loadAsync(null, progress),
];

export const transform = (job: Job): void => {
    job.transformAsync((value) => value, () => undefined);
};
`;

const typecheckProject = (project: { root: string }, file = "probe.ts"): void => {
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
            file,
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

    it("preserves natural subclass method names from system GIR libraries", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-gudev-property-",
            config: GUDEV_CONFIG,
            files: { "probe.ts": GUDEV_PROPERTY_PROBE },
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(() => {
            typecheckProject(project);
        }).not.toThrow();
        expect(evaluateProject(project, GUDEV_PROPERTY_PROBE)).toBe("");
    });

    it("rejects shadowed factories and invalid collision-safe signal emissions", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-shadow-errors-",
            config: GIO_CONFIG,
            files: { "signatures.ts": GIO_TYPE_PROBE, ...GIO_TYPE_ERRORS },
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(() => {
            typecheckProject(project, "signatures.ts");
        }).not.toThrow();

        for (const file of Object.keys(GIO_TYPE_ERRORS)) {
            expect(() => {
                typecheckProject(project, file);
            }).toThrow();
        }
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
