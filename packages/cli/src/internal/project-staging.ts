import { createRetainedStagingDir, type RetainedStagingDir } from "./staging-dir.js";

type ProjectStaging = {
    schemas: RetainedStagingDir;
    fonts: RetainedStagingDir;
};

const createProjectStaging = (): ProjectStaging => ({
    schemas: createRetainedStagingDir("schemas"),
    fonts: createRetainedStagingDir("fonts"),
});

export { createProjectStaging, type ProjectStaging };
