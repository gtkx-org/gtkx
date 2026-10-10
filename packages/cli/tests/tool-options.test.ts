import { resolveStore } from "@gtkx/codegen";
import { runCommand } from "citty";
import { execFileSync } from "node:child_process";
import { chmodSync, closeSync, constants, mkdirSync, openSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCommand } from "../dist/command.js";
import { createProject } from "./project.js";

const invoke = async (args: string[]) => runCommand(createCommand(), { rawArgs: args });

describe("CLI tool options", () => {
    it.each([false, true])("honors the codegen lock timeout with force=%s", async (isForced) => {
        using project = createProject({ codegen: true });
        const storeRoot = dirname(resolveStore(project.root).gi.storeDir);
        mkdirSync(storeRoot, { recursive: true });
        const lockFd = openSync(storeRoot, constants.O_RDONLY | constants.O_DIRECTORY);

        try {
            execFileSync("flock", ["--exclusive", "3"], { stdio: ["ignore", "ignore", "ignore", lockFd] });
            await expect(
                invoke(["codegen", "--cwd", project.root, "--lock-timeout", "25", ...(isForced ? ["--force"] : [])]),
            ).rejects.toThrow("raise the 25ms limit");
        } finally {
            closeSync(lockFd);
        }
    });

    it("packages Debian and RPM targets using the configured nFPM executable", async () => {
        using project = createProject({
            applicationIcon: "icon.svg",
            deploy: {
                name: "Tool Example",
                summary: "Exercises the configured packaging tool",
                categories: ["Utility"],
                description: [
                    "An application used to exercise configured packaging tools for Debian and RPM deployment targets.",
                ],
                developer: { name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                homepage: "https://gtkx.dev",
                node: { source: "host", shouldStrip: false },
                tools: { nfpm: "tools/nfpm.mjs" },
            },
        });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        project.write(
            "tools/nfpm.mjs",
            `#!${process.execPath}
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const target = args[args.indexOf("--target") + 1];
const config = args[args.indexOf("--config") + 1];
if (args[0] !== "package" || target === undefined || config === undefined) {
    throw new Error("Missing packaging arguments");
}
writeFileSync(target, JSON.stringify({
    packager: args[args.indexOf("--packager") + 1],
    config: readFileSync(config, "utf8"),
    cwd: process.cwd(),
}));
`,
        );
        chmodSync(join(project.root, "tools/nfpm.mjs"), 0o755);

        await invoke(["deploy", "--cwd", project.root, "--target", "deb,rpm"]);

        const output = join(project.root, "build/out");
        const packages = readdirSync(output);
        expect(packages.map((filename) => extname(filename)).toSorted()).toEqual([".deb", ".rpm"]);

        for (const filename of packages) {
            const artifact: unknown = JSON.parse(readFileSync(join(output, filename), "utf8"));
            expect(artifact).toMatchObject({
                packager: extname(filename).slice(1),
                cwd: project.root,
            });
            expect(artifact).toHaveProperty("config", expect.stringContaining("name: cli-example"));
        }
    });
});
