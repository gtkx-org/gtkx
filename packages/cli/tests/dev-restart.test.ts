import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    realpathSync,
    renameSync,
    rmSync,
    symlinkSync,
    unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { createProject } from "./project.js";
import { invoke, withSession } from "./invoke.js";

describe("gtkx dev restarts", () => {
    it("reloads imported configuration after atomic saves and missing directories are created", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"] });
        const readyPath = join(project.root, "ready.txt");
        const attemptedPath = join(project.root, "attempted.txt");
        const config = readFileSync(join(project.root, "gtkx.config.ts"), "utf8");
        project.write(
            "gtkx.config.ts",
            `import { applicationId } from "./settings.ts";\n${config.replace('"org.gtkx.example"', "applicationId")}`,
        );
        const settings = (applicationId: string) => `export const applicationId = ${JSON.stringify(applicationId)};`;
        project.write("settings.ts", settings("org.gtkx.initial"));
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { applicationId } from "virtual:gtkx-config";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(readyPath)}, applicationId);`,
        );

        await withSession("dev", project.root, readyPath, async () => {
            expect(readFileSync(readyPath, "utf8")).toBe("org.gtkx.initial");
            project.write("settings.tmp", settings("org.gtkx.atomic"));
            renameSync(join(project.root, "settings.tmp"), join(project.root, "settings.ts"));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("org.gtkx.atomic");

            project.write(
                "gtkx.config.ts",
                `import { writeFileSync } from "node:fs";
                export default async () => {
                    writeFileSync(${JSON.stringify(attemptedPath)}, "attempted");
                    const { applicationId } = await import("./generated/nested/settings.js");
                    ${config.replace("export default", "return").replace('"org.gtkx.example"', "applicationId")}
                };`,
            );
            await expect.poll(() => existsSync(attemptedPath), { timeout: 30_000 }).toBe(true);
            expect(readFileSync(readyPath, "utf8")).toBe("org.gtkx.atomic");
            project.write("generated/nested/settings.ts", settings("org.gtkx.recovered"));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("org.gtkx.recovered");

            project.write("generated/nested/settings.ts", settings("org.gtkx.updated"));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("org.gtkx.updated");

            rmSync(join(project.root, "generated/nested"), { recursive: true });
            await setTimeout(20);
            project.write("generated/nested/settings.ts", settings("org.gtkx.recreated"));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("org.gtkx.recreated");

            project.write("generated/nested/settings.ts", settings("org.gtkx.latest"));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("org.gtkx.latest");
        });
    });

    it("regenerates bindings and restarts when GIR files of declared libraries change", async () => {
        using project = createProject({ codegen: true, libraries: ["Probe-1.0"], girPath: ["gir"] });
        const readyPath = join(project.root, "ready.txt");
        const launchesPath = join(project.root, "launches.txt");
        const gir = (functions: string[], namespace = "Probe") => `<?xml version="1.0"?>
            <repository version="1.0" xmlns="http://www.gtk.org/introspection/core/1.0"
              xmlns:c="http://www.gtk.org/introspection/c/1.0" xmlns:glib="http://www.gtk.org/introspection/glib/1.0">
              <include name="GLib" version="2.0"/>
              <namespace name="${namespace}" version="1.0" shared-library="libglib-2.0.so.0" c:prefix="G">
                ${functions
                    .map(
                        (name) => `<function name="${name}" c:identifier="g_get_${name}">
                          <return-value transfer-ownership="none"><type name="utf8"/></return-value>
                        </function>`,
                    )
                    .join("\n")}
              </namespace>
            </repository>`;
        project.write("gir/Probe-1.0.gir", gir(["user_name"]));
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import * as Probe from "@gtkx/gi/probe";
            import { appendFileSync, writeFileSync } from "node:fs";
            export const application = new Application({ applicationId: "org.gtkx.example" });
            application.setDefault();
            application.register(null);
            application.hold();
            appendFileSync(${JSON.stringify(launchesPath)}, "x");
            writeFileSync(${JSON.stringify(readyPath)}, typeof Probe.hostName);`,
        );

        const output = await withSession("dev", project.root, readyPath, async () => {
            expect(readFileSync(readyPath, "utf8")).toBe("undefined");
            project.write("gir/Probe-1.0.gir", gir(["user_name", "host_name"]));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("function");
            expect(readFileSync(launchesPath, "utf8")).toBe("xx");

            project.write("gir/Extra-1.0.gir", gir(["user_name"], "Extra"));
            project.write(
                "gtkx.config.ts",
                readFileSync(join(project.root, "gtkx.config.ts"), "utf8").replace(
                    '"Probe-1.0"',
                    '"Probe-1.0","Extra-1.0"',
                ),
            );
            await expect.poll(() => readFileSync(launchesPath, "utf8"), { timeout: 30_000 }).toBe("xxx");
            project.write("gir/Extra-1.0.gir", gir(["user_name", "host_name"], "Extra"));
            await expect.poll(() => readFileSync(launchesPath, "utf8"), { timeout: 30_000 }).toBe("xxxx");
        });
        expect(output).toContain("regenerating bindings");

        project.write("gir/Probe-1.0.gir", gir(["user_name", "host_name", "real_name"]));
        expect(await invoke(["build", "--cwd", project.root])).toContain("generated bindings out of date");
    });

    it("restarts with the reinstalled dependency when the lockfile changes", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const install = (version: string) => {
            project.write(
                "node_modules/clock-format/package.json",
                JSON.stringify({ name: "clock-format", version, type: "module", exports: "./index.js" }),
            );
            project.write("node_modules/clock-format/index.js", `export const version = ${JSON.stringify(version)};`);
            project.write(
                "package-lock.json",
                JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/clock-format": { version } } }),
            );
        };
        install("1.0.0");
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { version } from "clock-format";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId: "org.gtkx.example" });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(readyPath)}, version);`,
        );

        await withSession("dev", project.root, readyPath, async () => {
            expect(readFileSync(readyPath, "utf8")).toBe("1.0.0");
            install("2.0.0");
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("2.0.0");
        });
    });

    it("keeps running through an install that leaves the GTKX packages unresolvable for a while", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const launchesPath = join(project.root, "launches.txt");
        const runtime = join(project.root, "node_modules/@gtkx/runtime");
        const lock = (step: number) =>
            project.write("package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: {}, step }));
        lock(0);
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { appendFileSync, writeFileSync } from "node:fs";
            export const application = new Application({ applicationId: "org.gtkx.example" });
            application.setDefault();
            application.register(null);
            application.hold();
            appendFileSync(${JSON.stringify(launchesPath)}, "x");
            writeFileSync(${JSON.stringify(readyPath)}, "ready");`,
        );

        await withSession("dev", project.root, readyPath, async () => {
            renameSync(runtime, `${runtime}.moving`);
            lock(1);
            await setTimeout(1000);
            renameSync(`${runtime}.moving`, runtime);
            lock(2);
            await expect.poll(() => readFileSync(launchesPath, "utf8"), { timeout: 30_000 }).toBe("xx");
        });
    });

    it("stops when an install points the project at another @gtkx/cli", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const cli = join(project.root, "node_modules/@gtkx/cli");
        const lock = (step: number) =>
            project.write("package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: {}, step }));
        lock(0);
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId: "org.gtkx.example" });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(readyPath)}, String(process.pid));`,
        );
        const isRunning = (pid: number) => {
            try {
                process.kill(pid, 0);
                return true;
            } catch {
                return false;
            }
        };

        const output = await withSession("dev", project.root, readyPath, async () => {
            const pid = Number(readFileSync(readyPath, "utf8"));
            unlinkSync(cli);
            project.write(
                "node_modules/@gtkx/cli/package.json",
                JSON.stringify({ name: "@gtkx/cli", version: "9.9.9" }),
            );
            lock(1);
            await expect.poll(() => isRunning(pid), { timeout: 30_000 }).toBe(false);
        });

        expect(output).toContain("was replaced by 9.9.9 while it was running");
    });

    it("restarts from the new copy when an install moves the project's @gtkx/cli without changing its version", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const launchesPath = join(project.root, "launches.txt");
        const cli = join(project.root, "node_modules/@gtkx/cli");
        const copy = join(project.root, "node_modules/.pnpm/cli-copy");
        const lock = (step: number) =>
            project.write("package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: {}, step }));
        lock(0);
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { appendFileSync, writeFileSync } from "node:fs";
            export const application = new Application({ applicationId: "org.gtkx.example" });
            application.setDefault();
            application.register(null);
            application.hold();
            appendFileSync(${JSON.stringify(launchesPath)}, process.argv[1] + "\\n");
            writeFileSync(${JSON.stringify(readyPath)}, "ready");`,
        );

        const output = await withSession("dev", project.root, readyPath, async () => {
            const original = realpathSync(cli);
            mkdirSync(copy, { recursive: true });
            for (const entry of readdirSync(original)) {
                symlinkSync(join(original, entry), join(copy, entry));
            }
            unlinkSync(cli);
            symlinkSync(copy, cli, "dir");
            lock(1);
            await expect
                .poll(() => readFileSync(launchesPath, "utf8").trim().split("\n"), { timeout: 30_000 })
                .toEqual([expect.not.stringContaining(copy), expect.stringContaining(copy)]);
        });

        expect(output).not.toContain("while it was running");
    });
});
