import { readFileSync } from "node:fs";
import type { CliProject } from "./cli-project.js";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.constructprops",
    libraries: ["Construct-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import type { ComponentProps } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import * as Construct from "@gtkx/gi/construct";
import {
    GtkSignalAction, type GtkSignalActionProps,
    GtkNamedAction, type GtkNamedActionProps,
    GtkAlternativeTrigger, type GtkAlternativeTriggerProps,
    GtkKeyvalTrigger, GtkMnemonicTrigger, GtkNeverTrigger,
} from "@gtkx/jsx/gtk";
import {
    ConstructConfiguredAction, type ConstructConfiguredActionProps,
    ConstructInheritedAction, type ConstructInheritedActionProps,
} from "@gtkx/jsx/construct";
const trigger = Gtk.NeverTrigger.get();
`;

const typecheckConstructProps = (project: CliProject, source: string): number | null =>
    typecheckSource(project, IMPORTS + source);

const createConstructPropsProject = (): ReturnType<typeof createCliProject> => {
    const fixture = new URL("fixtures/gir/Construct-1.0.gir", import.meta.url);
    const project = createCliProject({
        prefix: "gtkx-construct-props-",
        config: CONFIG,
        files: { "gir/Construct-1.0.gir": readFileSync(fixture, "utf8") },
    });
    using pending = new DisposableStack();
    pending.use(project);
    runCliOrThrow(project, ["codegen"]);
    isolateTypeConsumer(project);
    pending.move();

    return project;
};

export { createConstructPropsProject, typecheckConstructProps };
