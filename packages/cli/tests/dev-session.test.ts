import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "@gtkx/mcp/server";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProject, linkWorkspaceBindings } from "./project.js";
import { withSession, withMcpClient, callTool, writeWidgetApp } from "./invoke.js";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("gtkx dev sessions", () => {
    it("preserves arguments, configuration, translations and MCP across headless dev restarts", async () => {
        using project = createProject();
        linkWorkspaceBindings(project.root);
        const readyPath = join(project.root, "ready.txt");
        const argumentsPath = join(project.root, "arguments.json");
        const resourcesPath = join(project.root, "resources.json");
        const applicationArgs = ["--example", "a value", "--config=app-owned"];
        project.write("po/LINGUAS", "fr\n");
        project.write("po/fr.po", readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8"));
        vi.stubEnv("LANG", "fr_FR.UTF-8");
        vi.stubEnv("LC_ALL", "fr_FR.UTF-8");
        vi.stubEnv("LANGUAGE", "fr");
        const application = (revision: string) => `import { Application } from "@gtkx/gi/gio";
            import { t } from "@gtkx/i18n";
            import { applicationId } from "virtual:gtkx-config";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(argumentsPath)}, JSON.stringify(process.argv.slice(2)));
            writeFileSync(${JSON.stringify(resourcesPath)}, JSON.stringify(process.getActiveResourcesInfo()));
            writeFileSync(${JSON.stringify(readyPath)}, ${JSON.stringify(revision)} + ":" + applicationId + ":" + t("Hello, {{name}}!", { name: "Ada" }));`;
        project.write("src/index.ts", application("initial"));
        project.write("custom.config.ts", readFileSync(join(project.root, "gtkx.config.ts"), "utf8"));
        project.write("gtkx.config.ts", 'export default { applicationId: "org.gtkx.unselected", codegen: false };');
        vi.stubEnv("GTKX_MCP_SOCKET_PATH", undefined);
        vi.stubEnv("XDG_RUNTIME_DIR", project.root);
        const [clientTransport, transport] = InMemoryTransport.createLinkedPair();
        const server = createMcpServer({
            transport,
            socketPath: join(project.root, "gtkx-mcp.sock"),
            version: "1.0.0",
        });
        const client = new Client({ name: "dev-session-test", version: "1.0.0" });
        try {
            await server.start();
            await client.connect(clientTransport);
            const output = await withSession(
                "dev",
                project.root,
                readyPath,
                async () => {
                    expect(readFileSync(readyPath, "utf8")).toBe("initial:org.gtkx.example:Bonjour, Ada !");
                    expect(JSON.parse(readFileSync(argumentsPath, "utf8"))).toEqual(applicationArgs);
                    expect(process.env.GTKX_MCP_SOCKET_PATH).toBeUndefined();
                    expect(JSON.parse(readFileSync(resourcesPath, "utf8"))).not.toContain("TCPServerWrap");
                    const apps = await client.callTool({
                        name: "gtkx_list_apps",
                        arguments: { waitForApps: true, timeout: 30_000 },
                    });
                    expect(JSON.stringify(apps)).toContain("org.gtkx.example");
                    project.write("src/index.ts", application("updated"));
                    await expect
                        .poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 })
                        .toBe("updated:org.gtkx.example:Bonjour, Ada !");
                    const configPath = join(project.root, "custom.config.ts");
                    project.write(
                        "custom.config.ts",
                        readFileSync(configPath, "utf8").replace("org.gtkx.example", "org.gtkx.reloaded"),
                    );
                    await expect
                        .poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 })
                        .toBe("updated:org.gtkx.reloaded:Bonjour, Ada !");
                    expect(JSON.parse(readFileSync(argumentsPath, "utf8"))).toEqual(applicationArgs);
                    await expect
                        .poll(async () => JSON.stringify(await client.callTool({ name: "gtkx_list_apps" })), {
                            timeout: 30_000,
                        })
                        .toContain("org.gtkx.reloaded");
                },
                ["--config", "custom.config.ts"],
                applicationArgs,
            );
            expect(output).toContain("custom.config.ts changed");
            expect(output).not.toContain("regenerating bindings");
        } finally {
            await client.close();
            await server.stop();
        }
    });

    it("keeps the production translation domain and program name under a development application ID", async () => {
        using project = createProject({ codegen: true, $development: { applicationId: "org.gtkx.example.Devel" } });
        const readyPath = join(project.root, "ready.txt");
        project.write("po/LINGUAS", "fr\n");
        project.write("po/fr.po", readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8"));
        vi.stubEnv("LANG", "fr_FR.UTF-8");
        vi.stubEnv("LC_ALL", "fr_FR.UTF-8");
        vi.stubEnv("LANGUAGE", "fr");
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { getPrgname } from "@gtkx/gi/glib";
            import { t } from "@gtkx/i18n";
            import { applicationId } from "virtual:gtkx-config";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(readyPath)}, [applicationId, getPrgname(), t("Hello, {{name}}!", { name: "Ada" })].join(":"));`,
        );
        await withSession("dev", project.root, readyPath, () => Promise.resolve());
        expect(readFileSync(readyPath, "utf8")).toBe("org.gtkx.example.Devel:example:Bonjour, Ada !");
        expect(readdirSync(join(project.root, "po")).toSorted()).toEqual([
            "LINGUAS",
            "POTFILES.in",
            "fr.po",
            "org.gtkx.example.pot",
        ]);
    });

    it("translates the messages of a workspace package and extracts them again when it is saved in dev", async () => {
        using project = createProject();
        linkWorkspaceBindings(project.root);
        const app = join(project.root, "workspace/apps/recipes");
        const readyPath = join(project.root, "ready.txt");
        const greeting = "workspace/packages/ui/src/index.ts";
        const greet = (message: string) =>
            `import { t } from "@gtkx/i18n";\nexport const greet = (name: string): string => t(${JSON.stringify(message)}, { name });`;
        project.write(
            "workspace/apps/recipes/package.json",
            JSON.stringify({ name: "recipes", type: "module", dependencies: { "@studio/ui": "*" } }),
        );
        project.write(
            "workspace/apps/recipes/gtkx.config.ts",
            'export default { applicationId: "org.gtkx.example", codegen: false, agents: { reference: false, rules: false } };',
        );
        project.write("workspace/apps/recipes/po/LINGUAS", "fr\n");
        project.write(
            "workspace/apps/recipes/po/fr.po",
            readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8"),
        );
        project.write(
            "workspace/packages/ui/package.json",
            JSON.stringify({
                name: "@studio/ui",
                type: "module",
                exports: "./src/index.ts",
                peerDependencies: { "@gtkx/i18n": "*", "@gtkx/react": "*" },
            }),
        );
        project.write(greeting, greet("Hello, {{name}}!"));
        mkdirSync(join(project.root, "workspace/node_modules/@studio"), { recursive: true });
        symlinkSync("../../packages/ui", join(project.root, "workspace/node_modules/@studio/ui"), "dir");
        project.write(
            "workspace/apps/recipes/src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { greet } from "@studio/ui";
            import { applicationId } from "virtual:gtkx-config";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(readyPath)}, greet("Ada"));`,
        );
        vi.stubEnv("LANG", "fr_FR.UTF-8");
        vi.stubEnv("LC_ALL", "fr_FR.UTF-8");
        vi.stubEnv("LANGUAGE", "fr");

        await withSession("dev", app, readyPath, async () => {
            expect(readFileSync(readyPath, "utf8")).toBe("Bonjour, Ada !");
            project.write(greeting, greet("Goodbye, {{name}}!"));
            await expect
                .poll(() => readFileSync(join(app, "po/org.gtkx.example.pot"), "utf8"), { timeout: 30_000 })
                .toContain('#: ../../packages/ui/src/index.ts:2\nmsgid "Goodbye, {{name}}!"');
        });
    });

    it("keeps the dev session through malformed catalogs added while it runs", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const catalog = readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8");
        vi.stubEnv("LANG", "fr_FR.UTF-8");
        vi.stubEnv("LC_ALL", "fr_FR.UTF-8");
        vi.stubEnv("LANGUAGE", "fr");
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { t } from "@gtkx/i18n";
            import { applicationId } from "virtual:gtkx-config";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(readyPath)}, t("Hello, {{name}}!", { name: "Ada" }));`,
        );
        await withSession("dev", project.root, readyPath, async () => {
            expect(readFileSync(readyPath, "utf8")).toBe("Hello, Ada!");
            project.write("po/fr.po", `${catalog}\nmsgid "Unterminated\n`);
            project.write("po/LINGUAS", "fr\n");
            await expect
                .poll(() => existsSync(join(project.root, "po/org.gtkx.example.pot")), { timeout: 30_000 })
                .toBe(true);
            project.write("po/fr.po", catalog);
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("Bonjour, Ada !");
        });
    });

    it("reconnects without an error when the MCP server closes during registration", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
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
        const socketPath = join(project.root, "mcp.sock");
        const connections: Socket[] = [];
        const server = createServer((socket) => {
            connections.push(socket);
            const isFirst = connections.length === 1;
            socket.on("data", (data) => {
                if (isFirst && data.toString().includes("app.register")) socket.destroy();
            });
        });
        server.listen(socketPath);
        await once(server, "listening");
        const session = spawn(
            process.execPath,
            [join(project.root, "node_modules/@gtkx/cli/bin/gtkx.js"), "dev", "--headless", "--size", "640x480"],
            {
                cwd: project.root,
                env: {
                    ...Object.fromEntries(
                        Object.entries(process.env).filter(
                            ([name]) => !name.startsWith("VITEST") && name !== "DISPLAY",
                        ),
                    ),
                    GTKX_MCP_SOCKET_PATH: socketPath,
                },
            },
        );
        let output = "";
        session.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
        session.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
        const exited = once(session, "exit");
        try {
            await expect.poll(() => connections.length, { timeout: 60_000 }).toBeGreaterThan(1);
        } finally {
            session.kill("SIGTERM");
            await exited;
            for (const socket of connections) socket.destroy();
            server.close();
        }
        expect(output).toContain("Disconnected from MCP server");
        expect(output).not.toContain("Failed to register");
    });

    it("keeps the running app registered while configuration is invalid and restarts after repair", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const editedPath = join(project.root, "edited.txt");
        const configPath = join(project.root, "custom.config.ts");
        const config = readFileSync(join(project.root, "gtkx.config.ts"), "utf8");
        project.write("custom.config.ts", config);
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { applicationId } from "virtual:gtkx-config";
            import { existsSync, writeFileSync } from "node:fs";
            export const application = new Application({ applicationId: applicationId + ".Runtime" });
            application.setDefault();
            application.register(null);
            application.hold();
            if (!existsSync(${JSON.stringify(editedPath)})) {
                writeFileSync(${JSON.stringify(configPath)}, 'export default { applicationId: "invalid" };');
                writeFileSync(${JSON.stringify(editedPath)}, "edited");
            }
            writeFileSync(${JSON.stringify(readyPath)}, application.applicationId);`,
        );
        const socketPath = join(project.root, "mcp.sock");
        vi.stubEnv("GTKX_MCP_SOCKET_PATH", socketPath);
        const [clientTransport, transport] = InMemoryTransport.createLinkedPair();
        const server = createMcpServer({ transport, socketPath, version: "1.0.0" });
        const client = new Client({ name: "config-edit-test", version: "1.0.0" });
        try {
            await server.start();
            await client.connect(clientTransport);
            await withSession(
                "dev",
                project.root,
                readyPath,
                async () => {
                    expect(readFileSync(readyPath, "utf8")).toBe("org.gtkx.example.Runtime");
                    const apps = await client.callTool({
                        name: "gtkx_list_apps",
                        arguments: { waitForApps: true, timeout: 10_000 },
                    });
                    expect(JSON.stringify(apps)).toContain("org.gtkx.example");
                    expect(JSON.stringify(apps)).not.toContain("org.gtkx.example.Runtime");
                    project.write("custom.config.ts", config.replace("org.gtkx.example", "org.gtkx.repaired"));
                    await expect
                        .poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 })
                        .toBe("org.gtkx.repaired.Runtime");
                    await expect
                        .poll(async () => JSON.stringify(await client.callTool({ name: "gtkx_list_apps" })), {
                            timeout: 30_000,
                        })
                        .toContain("org.gtkx.repaired");
                },
                ["--config", "custom.config.ts"],
            );
        } finally {
            await client.close();
            await server.stop();
        }
    });

    it("keeps the dev session up after the application fails while activating", async () => {
        using project = createProject({ codegen: true });
        const failedPath = join(project.root, "failed.txt");
        const readyPath = join(project.root, "ready.txt");
        const entry = (activate: string) => `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { createRoot } from "@gtkx/react";
            import { writeFileSync } from "node:fs";
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.example" onActivate={() => { ${activate} }}>
                    <AdwApplicationWindow />
                </AdwApplication>
            );`;
        project.write(
            "src/index.tsx",
            entry(`writeFileSync(${JSON.stringify(failedPath)}, "failed"); throw new Error("Activation failed");`),
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, failedPath, async () => {
                await expect
                    .poll(async () => (await callTool(client, "gtkx_get_widget_tree", { appTimeout: 1000 })).text, {
                        timeout: 30_000,
                    })
                    .toContain("Activation failed");
                project.write("src/index.tsx", entry(`writeFileSync(${JSON.stringify(readyPath)}, "ready");`));
                await expect.poll(() => existsSync(readyPath), { timeout: 30_000 }).toBe(true);
            });
        });
    });

    it("waits once for a change after the application fails while starting", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `export const Content = () => {
                throw new Error("Rendering the card failed");
            };`,
        );
        await withMcpClient(project.root, async (client) => {
            const session = spawn(
                process.execPath,
                [join(project.root, "node_modules/@gtkx/cli/bin/gtkx.js"), "dev", "--headless", "--size", "640x480"],
                {
                    cwd: project.root,
                    env: Object.fromEntries(
                        Object.entries(process.env).filter(
                            ([name]) => !name.startsWith("VITEST") && name !== "DISPLAY",
                        ),
                    ),
                },
            );
            let output = "";
            session.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
            session.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
            const exited = once(session, "exit");
            try {
                await expect
                    .poll(async () => (await callTool(client, "gtkx_get_widget_tree", { appTimeout: 1000 })).text, {
                        timeout: 60_000,
                    })
                    .toContain("Rendering the card failed");
                project.write("src/content.tsx", "export const Content = () => null;");
                await expect.poll(() => existsSync(readyPath), { timeout: 60_000 }).toBe(true);
            } finally {
                session.kill("SIGTERM");
                await exited;
            }
            expect(output.match(/Waiting for a change/g)).toHaveLength(1);
        });
    });

    it("points application errors in development at the source line that threw", async () => {
        using project = createProject();
        writeWidgetApp(
            project,
            join(project.root, "ready.txt"),
            [
                `import { useEffect, useState } from "react";`,
                `export const Content = () => {`,
                `    const [isBroken, setIsBroken] = useState(false);`,
                `    useEffect(() => setIsBroken(true), []);`,
                `    if (isBroken) throw new Error("Rendering the card failed");`,
                `    return null;`,
                `};`,
            ].join("\n"),
        );
        const session = spawn(
            process.execPath,
            [join(project.root, "node_modules/@gtkx/cli/bin/gtkx.js"), "dev", "--headless", "--size", "640x480"],
            {
                cwd: project.root,
                env: Object.fromEntries(
                    Object.entries(process.env).filter(([name]) => !name.startsWith("VITEST") && name !== "DISPLAY"),
                ),
            },
        );
        let output = "";
        session.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
        session.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
        const exited = once(session, "exit");
        try {
            await expect.poll(() => output, { timeout: 60_000 }).toContain("Waiting for a change");
            expect(output).toMatch(/at Content \(.*\/src\/content\.tsx:5:\d+\)/);
        } finally {
            session.kill("SIGTERM");
            await exited;
        }
    });

    it("tells MCP clients which error stopped the application", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const failPath = join(project.root, ".gtkx", "fail");
        project.write(
            "src/index.tsx",
            `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { createRoot } from "@gtkx/react";
            import { existsSync, writeFileSync } from "node:fs";
            import { useEffect, useState } from "react";
            const Content = () => {
                const [hasFailed, setHasFailed] = useState(false);
                useEffect(() => {
                    writeFileSync(${JSON.stringify(readyPath)}, "ready");
                    const timer = setInterval(() => setHasFailed(existsSync(${JSON.stringify(failPath)})), 50);
                    return () => clearInterval(timer);
                }, []);
                if (hasFailed) throw new Error("Rendering the preview failed");
                return null;
            };
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.example">
                    <AdwApplicationWindow><Content /></AdwApplicationWindow>
                </AdwApplication>
            );`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const apps = await client.callTool({
                    name: "gtkx_list_apps",
                    arguments: { waitForApps: true, timeout: 30_000 },
                });
                expect(JSON.stringify(apps)).toContain("org.gtkx.example");
                project.write(".gtkx/fail", "fail");
                await expect
                    .poll(async () => JSON.stringify(await client.callTool({ name: "gtkx_get_widget_tree" })), {
                        timeout: 30_000,
                    })
                    .toContain("Rendering the preview failed");
                const listed = await callTool(client, "gtkx_list_apps");
                const [app] = JSON.parse(listed.text) as { applicationId: string; windows?: unknown; error?: string }[];
                expect(app).toMatchObject({ applicationId: "org.gtkx.example" });
                expect(app?.windows).toBeUndefined();
                expect(app?.error).toContain("Rendering the preview failed");
            });
        });
    });

    it("ends the application like Node when a native callback throws, unless the app handles it", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        const failPath = join(project.root, ".gtkx", "fail");
        const handledPath = join(project.root, "handled.txt");
        const content = (setup: string) =>
            `import * as GLib from "@gtkx/gi/glib";
            import { existsSync, rmSync, writeFileSync } from "node:fs";
            import { useEffect } from "react";
            ${setup}
            export const Content = () => {
                useEffect(() => {
                    const source = GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 50, () => {
                        if (existsSync(${JSON.stringify(failPath)})) {
                            rmSync(${JSON.stringify(failPath)});
                            throw new Error("Saving the draft failed");
                        }
                        return GLib.SOURCE_CONTINUE;
                    });
                    return () => GLib.sourceRemove(source);
                }, []);
                return null;
            };`;
        const listedApp = async (client: Client) =>
            (
                JSON.parse((await callTool(client, "gtkx_list_apps")).text) as {
                    windows?: unknown;
                    error?: string;
                }[]
            )[0];
        writeWidgetApp(project, readyPath, content(""));
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                project.write(".gtkx/fail", "fail");
                await expect
                    .poll(async () => (await listedApp(client))?.error, { timeout: 30_000 })
                    .toContain("Saving the draft failed");
                rmSync(readyPath);
                project.write(
                    "src/content.tsx",
                    content(
                        `process.on("uncaughtException", (error) => writeFileSync(${JSON.stringify(handledPath)}, String(error)));`,
                    ),
                );
                await expect.poll(() => existsSync(readyPath), { timeout: 30_000 }).toBe(true);
                project.write(".gtkx/fail", "fail");
                await expect.poll(() => existsSync(handledPath), { timeout: 30_000 }).toBe(true);
                expect((await listedApp(client))?.windows).toBeDefined();
            });
        });
    });
});
