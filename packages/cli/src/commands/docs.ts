import { type ElementProps, readBuiltinElements, resolveGirPath, resolveLibraries, writeDocs } from "@gtkx/codegen";
import { loadConfig } from "@gtkx/config";
import { info } from "@gtkx/utils";
import { defineCommand } from "citty";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveReactSubexports } from "../codegen/store-resolver.js";
import { cwdArg, resolveCwd } from "../internal/entry-arg.js";

const docs = defineCommand({
    meta: {
        name: "docs",
        description:
            "Generate markdown reference pages for the JSX elements of the GIR libraries declared in gtkx.config.ts",
    },
    args: {
        out: {
            type: "string",
            description: "Output directory for the generated markdown pages, relative to the project root",
            default: "docs/reference",
        },
        "base-path": {
            type: "string",
            description: "URL base path used for links between generated pages",
            default: "/reference",
        },
        force: {
            type: "boolean",
            description: "Regenerate even when the pages are up to date with the GIR libraries",
            default: false,
        },
        ...cwdArg,
    },
    async run({ args }) {
        const cwd = resolveCwd(args);
        const { config } = await loadConfig(cwd);

        if (config.codegen === false) {
            throw new Error(
                "codegen is disabled for this project, so there are no GIR libraries to document. " +
                "Remove `codegen: false` from gtkx.config.ts to use `gtkx docs`.",
            );
        }

        const girPath = resolveGirPath(config.girPath);

        if (girPath.length === 0) {
            throw new Error(
                "No GIR search paths available. Install gobject-introspection " +
                "(Linux: `sudo dnf install gobject-introspection-devel` or " +
                "`sudo apt install libgirepository1.0-dev`), or set `girPath` in gtkx.config.ts.",
            );
        }

        const libraries = resolveLibraries(config.libraries, girPath);
        const startedAt = Date.now();
        const outDir = resolve(cwd, args.out);

        const { regenerated, namespaces } = writeDocs({
            libraries,
            girPath,
            outDir,
            basePath: args["base-path"],
            props: await resolveDocsProps(cwd),
            force: args.force,
        });

        if (!regenerated) {
            info(`docs: pages in ${outDir} are up to date`);

            return;
        }

        const count = namespaces.reduce((total, namespace) => total + namespace.elements.length, 0);

        info(
            `docs: wrote ${String(count)} element pages across ${String(namespaces.length)} namespaces ` +
            `to ${outDir} in ${String(Date.now() - startedAt)}ms`,
        );
    },
});

const resolveDocsProps = async (cwd: string): Promise<ElementProps> => {
    const giStoreDir = join(cwd, "node_modules", ".gtkx", "gi");

    if (!existsSync(giStoreDir)) {
        return {};
    }

    const { props } = await readBuiltinElements(resolveReactSubexports(cwd), giStoreDir);

    return props;
};

export { docs };
