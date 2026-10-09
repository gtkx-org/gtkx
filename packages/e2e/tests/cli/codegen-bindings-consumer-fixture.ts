import type { BINDING_CONSUMERS } from "./codegen-binding-consumers.js";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
import { isolateTypeConsumer, typecheckFiles } from "./type-consumer.js";

type BindingConsumer = (typeof BINDING_CONSUMERS)[number];

const createBindingConsumerHarness = ({ library, accepted, rejected }: BindingConsumer) => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "", tmpDir: "" },
        status: null,
    };
    let results: ReturnType<typeof typecheckFiles> = new Map();

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
            results = typecheckFiles(state.project, [...Object.keys(accepted), ...Object.keys(rejected)]);
        },
        cleanup: () => {
            removeCliProject(state.project);
        },
        status: () => state.status,
        typecheck: (file: string) => {
            const result = results.get(file);

            if (result === undefined) {
                throw new Error(`Consumer was not typechecked: ${file}`);
            }

            return result.status;
        },
    };
};

export { createBindingConsumerHarness };
