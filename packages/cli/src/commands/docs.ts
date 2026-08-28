import { mergeOmittedProps, resolveGirPath, resolveLibraries } from "@gtkx/codegen";
import { writeDocs } from "@gtkx/codegen/internal";
import { loadConfig } from "@gtkx/config";
import { resolveFuture, resolveOmittedProps } from "@gtkx/config/internal";
import { info } from "@gtkx/utils";
import { defineCommand } from "citty";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { resolveDocsElements } from "../internal/docs-elements.js";
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
            description:
                "Output directory for the generated markdown pages, below the project root. It must be empty " +
                "or hold an earlier `gtkx docs` run, whose pages are replaced",
            default: "docs/reference",
        },
        "base-path": {
            type: "string",
            description: "URL base path used for links between generated pages",
            default: "/reference",
        },
        force: {
            type: "boolean",
            description:
                "Regenerate even when the pages are up to date with the GIR libraries, the base path, " +
                "and the element props the project configures",
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

        const future = resolveFuture(config.future);
        const libraries = resolveLibraries(config.libraries, girPath, future.isAdwaitaDefault);
        const startedAt = Date.now();
        const outDir = resolveOutDir(cwd, args.out);
        const builtin = await resolveDocsElements(cwd);

        const { isRegenerated, namespaces } = writeDocs({
            libraries,
            girPath,
            outDir,
            basePath: args["base-path"],
            props: builtin.props,
            omittedProps: mergeOmittedProps(builtin.omittedProps, resolveOmittedProps(config.elements)),
            isForced: args.force,
            isByteArrayTyped: future.isByteArrayTyped,
            isValueUnwrapped: future.isValueUnwrapped,
            isFinishTrimmed: future.isFinishTrimmed,
            isInoutInPlace: future.isInoutInPlace,
        });

        if (!isRegenerated) {
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

const isBelow = (parent: string, child: string): boolean => {
    const path = relative(parent, child);

    return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};

const outDirReason = (cwd: string, out: string, outDir: string): string => {
    if (out.trim() === "") {
        return "it was empty, which names the project root itself";
    }

    if (outDir === cwd) {
        return "it names the project root itself";
    }

    return `${outDir} is outside it`;
};

const resolveOutDir = (cwd: string, out: string): string => {
    const outDir = out.trim() === "" ? cwd : resolve(cwd, out);

    if (isBelow(cwd, outDir)) {
        return outDir;
    }

    throw new Error(
        `--out must name a directory below the project root ${cwd}, and ${outDirReason(cwd, out, outDir)}. ` +
        "Pass a path such as --out=docs/reference.",
    );
};

export { docs };
