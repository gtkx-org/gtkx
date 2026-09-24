import { resolveExecutable } from "@gtkx/utils";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CliProject } from "./cli-project.js";

const WORKSPACE = fileURLToPath(new URL("../../..", import.meta.url));
const TYPESCRIPT_CLI = join(WORKSPACE, "node_modules/typescript/bin/tsc");
const PACKAGES = ["cairo", "components", "config", "css", "forms", "native", "react", "runtime", "utils"];

const compileNativeFixture = (project: CliProject, source: string, library: string, pkg: string): void => {
    const flags = execFileSync(resolveExecutable("pkg-config"), ["--cflags", "--libs", pkg], {
        encoding: "utf8",
    }).trim().split(/\s+/);
    execFileSync(resolveExecutable("cc"), [
        "-shared", "-fPIC", "-Wall", "-Wextra", "-Werror", source,
        "-o", join(project.root, library), ...flags,
    ]);
};

const runNativeConsumer = (
    project: CliProject,
    file = "probe.ts",
    nodeOptions: readonly string[] = [],
): void => {
    const libraryPath = [project.root, process.env.LD_LIBRARY_PATH]
        .filter((entry) => entry !== undefined && entry !== "")
        .join(":");
    execFileSync(process.execPath, [...nodeOptions, "--conditions=source", "--import=tsx", file], {
        cwd: project.root,
        env: { ...process.env, LD_LIBRARY_PATH: libraryPath },
        stdio: "pipe",
        timeout: 30_000,
    });
};

const copyPackage = (project: CliProject, name: string): void => {
    const source = join(WORKSPACE, "packages", name);
    const target = join(project.nodeModules, "@gtkx", name);
    rmSync(target);
    mkdirSync(target);
    cpSync(join(source, "package.json"), join(target, "package.json"));

    if (name === "native") {
        for (const file of ["main.d.ts", "index.d.ts", "internal.d.ts"]) {
            cpSync(join(source, file), join(target, file));
        }
    } else {
        cpSync(join(source, "dist"), join(target, "dist"), { recursive: true });
    }
};

const copyTypeDependencies = (project: CliProject): void => {
    rmSync(join(project.nodeModules, "@types"));
    rmSync(join(project.nodeModules, "csstype"));

    const reconcilerTypes = realpathSync(join(WORKSPACE, "packages/react/node_modules/@types/react-reconciler"));
    cpSync(reconcilerTypes, join(project.nodeModules, "@types/react-reconciler"), { recursive: true });
    const typeFest = realpathSync(join(WORKSPACE, "packages/utils/node_modules/type-fest"));
    cpSync(typeFest, join(project.nodeModules, "type-fest"), { recursive: true });
    const toolkit = realpathSync(join(WORKSPACE, "packages/utils/node_modules/es-toolkit"));
    cpSync(toolkit, join(project.nodeModules, "es-toolkit"), { recursive: true });
    const formPackage = realpathSync(join(WORKSPACE, "packages/forms/node_modules/react-hook-form"));
    cpSync(formPackage, join(project.nodeModules, "react-hook-form"), { recursive: true });
    const taggedTag = realpathSync(join(dirname(typeFest), "tagged-tag"));
    cpSync(taggedTag, join(project.nodeModules, "tagged-tag"), { recursive: true });

    for (const name of ["node", "react"]) {
        const source = realpathSync(join(WORKSPACE, "node_modules", "@types", name));
        cpSync(source, join(project.nodeModules, "@types", name), { recursive: true });
        const dependency = name === "node" ? "undici-types" : "csstype";
        const dependencyModules = dirname(dirname(source));
        const dependencySource = realpathSync(join(dependencyModules, dependency));
        cpSync(dependencySource, join(project.nodeModules, dependency), { recursive: true });
    }
};

const isolateTypeConsumer = (project: CliProject): void => {
    for (const name of PACKAGES) {
        copyPackage(project, name);
    }

    copyTypeDependencies(project);
};

const typecheckFile = (project: CliProject, file: string, compilerOptions: readonly string[] = []): number => {
    const result = spawnSync(process.execPath, [
        TYPESCRIPT_CLI,
        "--noEmit",
        "--module", "ESNext",
        "--moduleResolution", "Bundler",
        "--target", "ESNext",
        "--jsx", "react-jsx",
        "--strict",
        "--skipLibCheck", "false",
        "--types", "node",
        ...compilerOptions,
        file,
    ], { cwd: project.root, encoding: "utf8" });

    if (result.status === null) {
        throw result.error ?? new Error("TypeScript did not exit normally");
    }

    return result.status;
};

const typecheckSource = (project: CliProject, source: string): number => {
    writeFileSync(join(project.root, "consumer.tsx"), source);

    return typecheckFile(project, "consumer.tsx");
};

export {
    compileNativeFixture,
    isolateTypeConsumer,
    runNativeConsumer,
    typecheckFile,
    typecheckSource,
};
