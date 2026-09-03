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

const TYPESCRIPT_CLI = fileURLToPath(
    new URL("../../../node_modules/typescript/bin/tsc", import.meta.url),
);
const GIO_CONFIG = `export default {
    applicationId: "com.gtkx.gioprobe",
    libraries: ["Gio-2.0"],
};
`;
const ORIENTABLE_CONFIG = `export default {
    applicationId: "com.gtkx.gtkprobe",
};
`;
const INTERFACE_PROPERTY_PROBE = `import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";

class Rail extends GObject.Object {}

const RegisteredRail = registerClass(Rail, {
    typeName: "GtkxPropertyHelperRail",
    implements: [Gtk.Orientable],
    properties: {
        orientation: GObject.paramSpecOverride("orientation", Gtk.Orientable),
    },
});
const rail = new RegisteredRail({});
const orientation: Gtk.Orientation = GObject.getProperty(rail, "orientation");
GObject.setProperty(rail, "orientation", Gtk.Orientation.HORIZONTAL);
`;
const PROPERTY_OVERRIDE_SPELLING_PROBE = `import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";

const names = ["margin-top", "margin_top", "marginTop"].map(
    (name) => GObject.paramSpecOverride(name, Gtk.Widget).name,
);
process.stdout.write(names.join(","));
`;
const PROPERTY_TYPE_ERRORS = {
    "pointer-property-read.ts": `import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";

declare const builder: Gdk.GLTextureBuilder;
GObject.getProperty(builder, "sync");
`,
    "pointer-property-write.ts": `import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";

declare const builder: Gdk.GLTextureBuilder;
GObject.setProperty(builder, "sync", 1n);
`,
    "union-override-source.ts": `import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";

declare const source: GObject.Type | typeof Gtk.Widget;

class Visibility extends GObject.Object {
    declare visible: boolean;
}

const RegisteredVisibility = registerClass(Visibility, {
    typeName: "GtkxPropertyHelperUnionOverride",
    properties: {
        visible: GObject.paramSpecOverride("visible", source),
    },
});
GObject.getProperty(new RegisteredVisibility({}), "visible");
`,
};
const GIO_TYPE_PROBE = `import type * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

declare const socket: Gio.Socket;
const blocking: boolean = GObject.getProperty(socket, "blocking");
const localAddress: Gio.SocketAddress | null = GObject.getProperty(socket, "localAddress");
GObject.setProperty(socket, "listenBacklog", 12);

class Mutable extends GObject.Object {
    declare count: number;
}

const RegisteredMutable = registerClass(Mutable, {
    typeName: "GtkxPropertyHelperMutable",
    properties: {
        count: GObject.paramSpecInt("count", null, null, 0, 10, 0, GObject.ParamFlags.READWRITE),
    },
});
const mutable = new RegisteredMutable({});
GObject.setProperty(mutable, "count", 7);
const count: number = GObject.getProperty(mutable, "count");

class InheritedMutable extends GObject.Object {
    get level(): number {
        return 0;
    }

    set level(value: number) {
        void value;
    }
}

const RegisteredInheritedMutable = registerClass(InheritedMutable, {
    typeName: "GtkxPropertyHelperInheritedMutable",
    properties: {
        level: GObject.paramSpecInt("level", null, null, 0, 10, 0, GObject.ParamFlags.READWRITE),
    },
});

class InheritedReadOnly extends RegisteredInheritedMutable {
    override get level(): number {
        return 0;
    }
}

const RegisteredInheritedReadOnly = registerClass(InheritedReadOnly, {
    typeName: "GtkxPropertyHelperInheritedReadOnly",
    properties: {
        level: GObject.paramSpecInt("level", null, null, 0, 10, 0, GObject.ParamFlags.READABLE),
    },
});
const inheritedReadOnly = new RegisteredInheritedReadOnly({});
const level: number = GObject.getProperty(inheritedReadOnly, "level");

class InheritedReadWrite extends RegisteredInheritedMutable {}

const RegisteredInheritedReadWrite = registerClass(InheritedReadWrite, {
    typeName: "GtkxPropertyHelperInheritedReadWrite",
    properties: {
        level: GObject.paramSpecInt("level", null, null, 0, 10, 0, GObject.ParamFlags.READWRITE),
    },
});
const inheritedReadWrite = new RegisteredInheritedReadWrite({});
GObject.setProperty(inheritedReadWrite, "level", 4);
const inheritedLevel: number = GObject.getProperty(inheritedReadWrite, "level");

class Wide extends GObject.Object {
    declare serial: bigint;
}

const RegisteredWide = registerClass(Wide, {
    typeName: "GtkxPropertyHelperWide",
    properties: {
        serial: GObject.paramSpecInt64("serial", null, null, 0n, 100n, 0n, GObject.ParamFlags.READWRITE),
    },
});
const wide = new RegisteredWide({});
GObject.setProperty(wide, "serial", 42n);
const serial: bigint = GObject.getProperty(wide, "serial");

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
    "unknown-property.ts": `import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
declare const socket: Gio.Socket;
GObject.getProperty(socket, "notReal");
`,
    "readonly-property.ts": `import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
declare const socket: Gio.Socket;
GObject.setProperty(socket, "family", Gio.SocketFamily.IPV4);
`,
    "wrong-property-value.ts": `import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
declare const socket: Gio.Socket;
GObject.setProperty(socket, "blocking", "false");
`,
    "dynamic-readonly-property.ts": `import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class ReadOnly extends GObject.Object {
    declare readonly count: number;
}

const RegisteredReadOnly = registerClass(ReadOnly, {
    typeName: "GtkxPropertyHelperReadOnly",
    properties: {
        count: GObject.paramSpecInt("count", null, null, 0, 10, 0, GObject.ParamFlags.READABLE),
    },
});
GObject.setProperty(new RegisteredReadOnly({}), "count", 1);
`,
    "dynamic-method-property-read.ts": `import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class Collision extends GObject.Object {
    score(): string {
        return "method";
    }
}

const RegisteredCollision = registerClass(Collision, {
    typeName: "GtkxPropertyHelperReadCollision",
    properties: {
        score: GObject.paramSpecInt("score", null, null, 0, 10, 0, GObject.ParamFlags.READWRITE),
    },
});
GObject.getProperty(new RegisteredCollision({}), "score");
`,
    "dynamic-method-property-write.ts": `import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class Collision extends GObject.Object {
    score(): string {
        return "method";
    }
}

const RegisteredCollision = registerClass(Collision, {
    typeName: "GtkxPropertyHelperWriteCollision",
    properties: {
        score: GObject.paramSpecInt("score", null, null, 0, 10, 0, GObject.ParamFlags.READWRITE),
    },
});
GObject.setProperty(new RegisteredCollision({}), "score", 1);
`,
    "dynamic-inherited-readonly-property.ts": `import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class Mutable extends GObject.Object {
    get level(): number {
        return 0;
    }

    set level(value: number) {
        void value;
    }
}

const RegisteredMutable = registerClass(Mutable, {
    typeName: "GtkxPropertyHelperInheritedErrorMutable",
    properties: {
        level: GObject.paramSpecInt("level", null, null, 0, 10, 0, GObject.ParamFlags.READWRITE),
    },
});

class ReadOnly extends RegisteredMutable {
    override get level(): number {
        return 0;
    }
}

const RegisteredReadOnly = registerClass(ReadOnly, {
    typeName: "GtkxPropertyHelperInheritedErrorReadOnly",
    properties: {
        level: GObject.paramSpecInt("level", null, null, 0, 10, 0, GObject.ParamFlags.READABLE),
    },
});
GObject.setProperty(new RegisteredReadOnly({}), "level", 1);
`,
    "dynamic-pointer-property-read.ts": `import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class PointerValue extends GObject.Object {
    declare pointer: bigint | null;
}

const RegisteredPointerValue = registerClass(PointerValue, {
    typeName: "GtkxPropertyHelperPointerRead",
    properties: {
        pointer: GObject.paramSpecPointer("pointer", null, null, GObject.ParamFlags.READWRITE),
    },
});
GObject.getProperty(new RegisteredPointerValue({}), "pointer");
`,
    "dynamic-pointer-property-write.ts": `import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class PointerValue extends GObject.Object {
    declare pointer: bigint | null;
}

const RegisteredPointerValue = registerClass(PointerValue, {
    typeName: "GtkxPropertyHelperPointerWrite",
    properties: {
        pointer: GObject.paramSpecPointer("pointer", null, null, GObject.ParamFlags.READWRITE),
    },
});
GObject.setProperty(new RegisteredPointerValue({}), "pointer", 1n);
`,
    "dynamic-widened-property-read.ts": `import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";

class Wide extends GObject.Object {
    declare serial: bigint;
}

const spec: GObject.ParamSpec = GObject.paramSpecInt64(
    "serial",
    null,
    null,
    0n,
    100n,
    0n,
    GObject.ParamFlags.READWRITE,
);
const RegisteredWide = registerClass(Wide, {
    typeName: "GtkxPropertyHelperWidened",
    properties: { serial: spec },
});
GObject.getProperty(new RegisteredWide({}), "serial");
`,
};
const NATURAL_PROPERTY_METHOD_PROBE = `import type { Station } from "@gtkx/gi/hookslots";

declare const station: Station;
const value: string | null = station.getProperty("key");
`;
const SIDE_CALLBACK_PROBE = `import type { Job, ProgressCallback } from "@gtkx/gi/asyncpair";

export const load = (job: Job, progress: ProgressCallback): Promise<boolean>[] => [
    job.loadAsync(),
    job.loadAsync(null, progress),
    job.loadAsync(null, null),
];

export const transform = (job: Job): void => {
    job.transformAsync((value) => value, () => undefined);
};
`;

const typecheckProject = (
    project: { root: string },
    file = "probe.ts",
): void => {
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
        [
            "--conditions=source",
            "--import=tsx",
            "--input-type=module",
            "--eval",
            source,
        ],
        {
            cwd: project.root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        },
    );

const expectGenerated = (
    library: string,
    namespace: string,
    expected: ExpectedOutput,
): void => {
    using project = createCliProject({
        prefix: `gtkx-cli-codegen-${namespace}-`,
        config: fixtureConfig(library),
    });

    expect(runCli(project, ["codegen"]).status).toBe(0);
    const declarations = generatedModule(
        project,
        "gi",
        namespace,
        `${namespace}.d.ts`,
    );
    const bindings = generatedModule(
        project,
        "gi",
        namespace,
        `${namespace}.js`,
    );
    expect(
        expected.declarations.filter((text) => !declarations.includes(text)),
    ).toEqual([]);
    expect(
        expected.bindings.filter((text) => !bindings.includes(text)),
    ).toEqual([]);
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
            bindings: [
                ...VALUE_PARAMETER_BINDINGS,
                "isReturnUnpacked: true",
                "isUnpacked: true",
            ],
        });
    });

    it("trims the leading success value from finish results", () => {
        expectGenerated("AsyncPair-1.0", "asyncpair", {
            declarations: [
                "runAsync(): Promise<[string, number]>",
                "probeAsync(): Promise<boolean>",
            ],
            bindings: [
                "promisify(asyncPairJobRunAsync, trimFinish(this.runFinish.bind(this))",
            ],
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

    it("preserves natural subclass method names from configured GIR libraries", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-natural-property-",
            config: fixtureConfig("HookSlots-1.0"),
            files: { "probe.ts": NATURAL_PROPERTY_METHOD_PROBE },
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(() => {
            typecheckProject(project);
        }).not.toThrow();
    });

    it("retains marshalable interface properties and rejects unsafe property helpers", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-interface-property-",
            config: ORIENTABLE_CONFIG,
            files: {
                "probe.ts": INTERFACE_PROPERTY_PROBE,
                ...PROPERTY_TYPE_ERRORS,
            },
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(() => {
            typecheckProject(project);
        }).not.toThrow();
        expect(evaluateProject(project, PROPERTY_OVERRIDE_SPELLING_PROBE)).toBe(
            "margin-top,margin-top,margin-top",
        );

        for (const file of Object.keys(PROPERTY_TYPE_ERRORS)) {
            expect(() => {
                typecheckProject(project, file);
            }).toThrow();
        }
    });

    it("rejects shadowed factories and invalid collision-safe operations", () => {
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
            files: {
                "probe.ts": `import { Client } from "@gtkx/gi/initable-only";
new Client();`,
            },
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(() => {
            typecheckProject(project);
        }).toThrow();
        const source = `import { DBusProxy } from "@gtkx/gi/gio";
new DBusProxy();`;
        expect(() => evaluateProject(project, source)).toThrow();
    });
});
