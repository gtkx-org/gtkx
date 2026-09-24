import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.gstpropertymaps", libraries: ["Gst-1.0"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as Gst from "@gtkx/gi/gst";
import * as GObject from "@gtkx/gi/gobject";
import { getProperty, setProperty } from "@gtkx/runtime";
`;
const ACCEPTED = IMPORTS + `
export const construct = (object: Gst.Object): Gst.ControlBindingConstructorProps[] => [
    { name: "volume", object }, { name: null, object: null }, { name: undefined, object: undefined },
];
export const read = (binding: Gst.ControlBinding): [string | null, Gst.Object | null, string | null] => [
    getProperty(binding, "name"), getProperty(binding, "object"), binding.getPathString(),
];
export const identities = (binding: Gst.ControlBinding): [GObject.Object, GObject.TypeInstance] => [
    binding, binding,
];
export const write = (object: Gst.Object, binding: Gst.ControlBinding): void => {
    setProperty(object, "name", "renamed");
    setProperty(object, "name", null);
    setProperty(binding, "parent", object);
    setProperty(binding, "parent", null);
};
export class Derived extends Gst.ControlBinding {
    value(timestamp: Gst.ClockTime): GObject.Value | null {
        return super.vfuncGetValue(timestamp);
    }
}
`;
const REJECTED: Record<string, string> = {
    "construct-only-name": "export const write = (binding: Gst.ControlBinding) => " +
        'setProperty(binding, "name", "next");',
    "construct-only-null-name": "export const write = (binding: Gst.ControlBinding) => " +
        'setProperty(binding, "name", null);',
    "construct-only-object": "export const write = (binding: Gst.ControlBinding, object: Gst.Object) => " +
        'setProperty(binding, "object", object);',
    "construct-only-null-object": "export const write = (binding: Gst.ControlBinding) => " +
        'setProperty(binding, "object", null);',
    "readonly-name": 'export const write = (binding: Gst.ControlBinding) => { binding.name = "next"; };',
    "readonly-object": "export const write = (binding: Gst.ControlBinding) => { binding.object = null; };",
};

describe("generated Gst property maps", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
            `${name}.ts`, IMPORTS + source,
        ]));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-gst-property-maps-", config: CONFIG,
            files: { "accepted.ts": ACCEPTED, ...rejectedFiles },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves construction, reads, inherited writes and protected methods", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects an unsupported property write %s", (name) => {
        expect(typecheckFile(project, `${name}.ts`)).not.toBe(0);
    });
});
