import type { BINDING_CONSUMERS } from "./codegen-binding-consumers.js";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

type BindingConsumer = (typeof BINDING_CONSUMERS)[number];

const createBindingConsumerHarness = ({ library, accepted, rejected }: BindingConsumer) => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "", tmpDir: "" },
        status: null,
    };

    return {
        accepted: Object.keys(accepted),
        rejected: Object.keys(rejected),
        setup: () => {
            state.project = createCliProject({
                prefix: "gtkx-cli-codegen-bindings-",
                config: fixtureConfig(library),
                files: { ...accepted, ...rejected },
            });
            state.status = runCli(state.project, ["codegen"]).status;
            isolateTypeConsumer(state.project);
        },
        cleanup: () => {
            removeCliProject(state.project);
        },
        status: () => state.status,
        typecheck: (file: string) => typecheckFile(state.project, file),
    };
};

export { createBindingConsumerHarness };
