import { info } from "@gtkx/utils";
import { defineCommand } from "citty";
import { build as buildApp } from "../builder.js";
import { prepareBuildOutDir, resolveBuildOutDir } from "../internal/build-output.js";
import { configArg, entryArg } from "../internal/entry-arg.js";
import { prepareProject } from "../internal/prepare-project.js";

const BUILD_MODE = "production";

const build = defineCommand({
    meta: {
        name: "build",
        description: "Build application for production",
    },
    args: {
        ...entryArg,
        ...configArg,
        out: {
            type: "string",
            description: "Output directory below the project root (default: dist)",
        },
    },
    async run({ args }) {
        const { cwd, entry, configFile } = await prepareProject(args, BUILD_MODE);
        const outDir = resolveBuildOutDir(cwd, args.out);
        using preparedOutput = prepareBuildOutDir(cwd, outDir);
        info(`Building ${entry}`);

        const bundlePath = await buildApp({
            entry,
            configFile,
            vite: {
                root: cwd,
                build: { outDir: preparedOutput.path, emptyOutDir: false },
            },
        });

        preparedOutput.commit();
        info(`Build complete: ${bundlePath}`);
    },
});

export { build };
