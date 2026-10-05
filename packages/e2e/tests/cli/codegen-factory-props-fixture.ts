import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.factoryprops",
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import type { ComponentProps } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkCallbackAction, type GtkCallbackActionProps,
    GtkShortcutTrigger, type GtkShortcutTriggerProps,
    GtkKeyvalTrigger, type GtkKeyvalTriggerProps,
    GtkNeverTrigger, type GtkNeverTriggerProps,
} from "@gtkx/jsx/gtk";
`;
const typecheckFactorySource = (project: CliProject, source: string): number | null =>
    typecheckSource(project, IMPORTS + source);
const createFactoryPropsProject = (): ReturnType<typeof createCliProject> => {
    const project = createCliProject({ prefix: "gtkx-factory-props-", config: CONFIG });
    using pending = new DisposableStack();
    pending.use(project);
    runCliOrThrow(project, ["codegen"]);
    isolateTypeConsumer(project);
    pending.move();

    return project;
};

export { createFactoryPropsProject, typecheckFactorySource };
