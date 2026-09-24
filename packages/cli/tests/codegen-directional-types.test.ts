import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.directionaltypes",
    libraries: ["DirectionalTypes-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;

const ACCEPTED = `import * as DirectionalTypes from "@gtkx/gi/directionaltypes";
import { DirectionalTypesProbe } from "@gtkx/jsx/directionaltypes";
import { createElement } from "react";

DirectionalTypes.borrowValues(new Int32Array([1, 2, 3]));
DirectionalTypes.takeValues([1, 2, 3]);
const returned: number[] = DirectionalTypes.returnValues();
const transform: DirectionalTypes.Transform = (value) => {
    const received: bigint = value;
    return [Number(received), 2];
};
DirectionalTypes.useTransform(transform);

declare const probe: DirectionalTypes.Probe;
probe.value = 3;
const property: bigint = probe.value;
const result: bigint = probe.accept(4);
new DirectionalTypes.Probe({ value: 5 });
createElement(DirectionalTypesProbe, {
    value: 6,
    onChanged: (value) => {
        const received: bigint = value;
        return Number(received);
    },
});
probe.connect("changed", (value) => {
    const received: bigint = value;
    return Number(received);
});
const emitted: bigint = probe.emit("changed", 9);

class Derived extends DirectionalTypes.Probe {
    override vfuncTransform(value: bigint): [number, number] {
        return [Number(value), 10];
    }
}
type TransformVfunc = DirectionalTypes.Probe["vfuncTransform"];
const vfuncInput = (value: Parameters<TransformVfunc>[0]): bigint => value;
const vfuncResult: ReturnType<TransformVfunc> = [11, 12];

declare const frame: DirectionalTypes.Frame;
frame.value = 7;
const field: bigint = frame.value;
new DirectionalTypes.Frame({ value: 8 });

export { Derived, emitted, field, property, result, returned, transform, vfuncInput, vfuncResult };
`;

const REJECTED = {
    "transferred-view.ts": `import * as DirectionalTypes from "@gtkx/gi/directionaltypes";
DirectionalTypes.takeValues(new Int32Array([1, 2, 3]));
`,
    "nullable-probe.ts": `import * as DirectionalTypes from "@gtkx/gi/directionaltypes";
new DirectionalTypes.Probe({ value: null });
`,
    "nullable-frame.ts": `import * as DirectionalTypes from "@gtkx/gi/directionaltypes";
new DirectionalTypes.Frame({ value: null });
`,
};

describe("generated directional input types", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/DirectionalTypes-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-directional-types-",
            config: CONFIG,
            files: {
                "gir/DirectionalTypes-1.0.gir": fixture,
                "accepted.ts": ACCEPTED,
                ...REJECTED,
            },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts widened inputs while preserving precise outputs", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the invalid input in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });
});
