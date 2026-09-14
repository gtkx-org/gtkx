import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const SCRIPT_PATH = "package scripts/after install.sh";
const SCRIPT_BODY = "test -n gtkx-package-script";
const SCRIPT = `#!/bin/sh\n${SCRIPT_BODY}\n`;
const FILES = {
    "application.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>',
    "src/index.ts": 'process.stdout.write("package script integration");',
};
const CONFIG = {
    applicationId: "org.gtkx.packagescripts",
    applicationIcon: "application.svg",
    codegen: false,
    agents: { reference: false },
    deploy: {
        name: "Package Scripts",
        binaryName: "gtkx-package-scripts",
        developer: { name: "GTKX" },
        summary: "Exercises package script paths",
        description: ["An integration application for package script resolution."],
        categories: ["Utility"],
        license: "MPL-2.0",
        metadataLicense: "CC0-1.0",
        node: { source: "host", shouldStrip: false },
    },
};

const packageScript = (root: string, format: string): string => {
    const output = join(root, "build", "out");
    const artifact = readdirSync(output).find((name) => name.endsWith(`.${format}`));

    if (artifact === undefined) {
        throw new Error("Missing package artifact");
    }

    const path = join(output, artifact);

    if (format === "rpm") {
        return execFileSync(resolveExecutable("rpm"), ["-qp", "--qf", "%{POSTIN}", path], { encoding: "utf8" });
    }

    const archive = execFileSync(resolveExecutable("ar"), ["p", path, "control.tar.gz"]);

    return execFileSync(resolveExecutable("tar"), ["-xzOf", "-", "./postinst"], { input: archive, encoding: "utf8" });
};

describe("package hook script paths", () => {
    it.each([
        ["deb", "relative"],
        ["rpm", "relative"],
        ["deb", "absolute"],
        ["rpm", "absolute"],
    ])("packages %s scripts using %s project paths", (format, pathKind) => {
        using project = createCliProject({
            prefix: "gtkx-deploy-scripts-",
            hasStore: true,
            files: { ...FILES, [SCRIPT_PATH]: SCRIPT },
        });
        const path = pathKind === "absolute" ? join(project.root, SCRIPT_PATH) : SCRIPT_PATH;
        const config = { ...CONFIG, deploy: { ...CONFIG.deploy, scripts: { postInstall: path } } };
        writeFileSync(join(project.root, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);
        runCliOrThrow(project, ["deploy", "--target", format]);
        expect(packageScript(project.root, format)).toContain(SCRIPT_BODY);
    });

    it.each(["deb", "rpm"])("rejects a missing %s package script", (format) => {
        const config = { ...CONFIG, deploy: { ...CONFIG.deploy, scripts: { postInstall: SCRIPT_PATH } } };
        using project = createCliProject({
            prefix: "gtkx-deploy-missing-script-",
            config: `export default ${JSON.stringify(config)};\n`,
            hasStore: true,
            files: FILES,
        });
        expect(() => runCliOrThrow(project, ["deploy", "--target", format])).toThrow();
    });
});
