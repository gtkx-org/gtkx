import { info } from "@gtkx/utils";
import { defineCommand } from "citty";
import { build as buildApp } from "../builder.js";
import { entryArg } from "../internal/entry-arg.js";
import { prepareProject } from "../internal/prepare-project.js";

const BUILD_MODE = "production";

const build = defineCommand({
    meta: {
        name: "build",
        description: "Build application for production",
    },
    args: {
        ...entryArg,
    },
    async run({ args }) {
        const { cwd, entry } = await prepareProject(args, BUILD_MODE);
        info(`Building ${entry}`);

        const bundlePath = await buildApp({
            entry,
            vite: {
                root: cwd,
            },
        });

        info(`Build complete: ${bundlePath}`);
    },
});

export { build };
