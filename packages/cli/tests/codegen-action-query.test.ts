import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, runNativeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.actionquery", libraries: ["Gio-2.0"],' +
    " agents: { reference: false, rules: false } };";
const IMPORTS = 'import * as Gio from "@gtkx/gi/gio";\nimport * as GLib from "@gtkx/gi/glib";\n';
const CONSUMER = IMPORTS + `import assert from "node:assert/strict";
import { quit, registerClass } from "@gtkx/runtime";

type Query = ReturnType<Gio.ActionGroup["queryAction"]>;
export const stateless: Query = [true, true, null, null, null, null];
export const virtual: ReturnType<Gio.ActionGroup["vfuncQueryAction"]> = stateless;

const populate = (group: Gio.SimpleActionGroup): void => {
    group.addAction(new Gio.SimpleAction({ name: "plain" }));
    group.addAction(new Gio.SimpleAction({ name: "parameter", parameterType: GLib.VariantType.new("s") }));
    group.addAction(Gio.SimpleAction.newStateful("toggle", null, GLib.Variant.newBoolean(true)));
    const choice = Gio.SimpleAction.newStateful("choice", GLib.VariantType.new("s"), GLib.Variant.newString("red"));
    choice.setStateHint(GLib.Variant.newStrv(["red", "blue"]));
    choice.setEnabled(false);
    group.addAction(choice);
};

const check = (group: Gio.SimpleActionGroup): void => {
    assert.deepEqual(group.queryAction("plain"), stateless);
    const parameter = group.queryAction("parameter");
    assert.deepEqual(parameter.slice(0, 2), [true, true]);
    assert.ok(parameter[2] !== null);
    assert.equal(parameter[2].dupString(), "s");
    assert.deepEqual(parameter.slice(3), [null, null, null]);

    const toggle = group.queryAction("toggle");
    assert.deepEqual(toggle.slice(0, 3), [true, true, null]);
    assert.ok(toggle[3] !== null);
    assert.equal(toggle[3].dupString(), "b");
    assert.equal(toggle[4], null);
    assert.ok(toggle[5] !== null);
    assert.equal(toggle[5].getBoolean(), true);

    const [found, enabled, parameterType, stateType, hint, state] = group.queryAction("choice");
    assert.equal(found, true);
    assert.equal(enabled, false);
    assert.ok(parameterType !== null && stateType !== null && hint !== null && state !== null);
    assert.equal(parameterType.dupString(), "s");
    assert.equal(stateType.dupString(), "s");
    assert.deepEqual(hint.getStrv(), ["red", "blue"]);
    assert.equal(state.getString()[0], "red");
    assert.equal(group.queryAction("missing")[0], false);
    assert.throws(() => Reflect.apply(group.queryAction, group, [42]));
};

try {
    const ordinary = new Gio.SimpleActionGroup();
    populate(ordinary);
    check(ordinary);
    assert.deepEqual(ordinary.vfuncQueryAction("plain"), stateless);

    class Group extends Gio.SimpleActionGroup {
        override vfuncQueryAction(name: string): Query {
            return name === "own" ? stateless : super.vfuncQueryAction(name);
        }
    }
    registerClass(Group, { typeName: "GtkxNullableQueryGroup" });
    const custom = new Group();
    populate(custom);
    check(custom);
    assert.deepEqual(custom.queryAction("own"), stateless);
    assert.equal(custom.getActionParameterType("own"), null);
    assert.equal(custom.getActionStateType("own"), null);
    assert.equal(custom.getActionStateHint("own"), null);
    assert.equal(custom.getActionState("own"), null);
    ordinary.removeAction("plain");
    assert.equal(ordinary.queryAction("plain")[0], false);
} finally {
    quit();
}
`;
const CONTROL = IMPORTS + `export const read = (group: Gio.ActionGroup): [boolean, boolean] => {
    const [found, enabled] = group.queryAction("plain");
    return [found, enabled];
};
`;
const OUTPUTS = ["GLib.VariantType", "GLib.VariantType", "GLib.Variant", "GLib.Variant"];
const REJECTED = Object.fromEntries(
    ["queryAction", "vfuncQueryAction"].flatMap((method) => OUTPUTS.map((type, index) => [
        `${method}-${String(index + 2)}.ts`,
        IMPORTS + `export const read = (group: Gio.ActionGroup): ${type} => ` +
        `group.${method}("plain")[${String(index + 2)}];`,
    ])),
);

describe("generated action query nullability", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-action-query-types-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER, "control.ts": CONTROL, ...REJECTED },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts nullable results and subclass overrides", () => {
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it("preserves non-null boolean results", () => {
        expect(typecheckFile(project, "control.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects non-null output assumptions in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents nullable method and vfunc results", () => {
        const reference = loadApiReference({
            libraries: ["Gio-2.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        const page = reference.lookup("Gio.ActionGroup", "interface");
        const tuple = "[boolean, boolean, GLib.VariantType | null, GLib.VariantType | null, " +
            "GLib.Variant | null, GLib.Variant | null]";
        expect(page.outcome).toBe("page");
        expect(page).toHaveProperty("markdown", expect.stringContaining(`queryAction(actionName: string): ${tuple}`));
        expect(page).toHaveProperty(
            "markdown", expect.stringContaining(`vfuncQueryAction(actionName: string): ${tuple}`),
        );
    });

    it("queries native actions and nullable overrides through public bindings", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-action-query-native-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});
