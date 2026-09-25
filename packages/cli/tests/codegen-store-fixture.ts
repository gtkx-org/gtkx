import { removeCliProject } from "./cli-project.js";
import { config, initialRunState, runInitialCodegen } from "./codegen-helpers.js";

const createCodegenStoreHarness = () => {
    const state = initialRunState();

    return {
        state,
        setup: () => {
            runInitialCodegen(state, { prefix: "gtkx-cli-codegen-", config: config("") });
        },
        cleanup: () => {
            removeCliProject(state.project);
        },
    };
};

export { createCodegenStoreHarness };
