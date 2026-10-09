import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { runCommand } from "citty";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stdout, stderr } from "test-console";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommand } from "../dist/command.js";
import { createProject } from "./project.js";

const invoke = async (args: string[], selected = createCommand()) => {
    let output = "";
    let errors = "";
    await stderr.inspectAsync(async (chunks) => {
        await stdout.inspectAsync(async (messages) => {
            await runCommand(selected, { rawArgs: args });
            output = messages.join("");
        });
        errors = chunks.join("");
    });
    return output + errors;
};

const withSession = async (name: string, root: string, readyPath: string, verify: () => Promise<void>) => {
    const controller = new AbortController();
    const running = invoke(
        [name, "--cwd", root, "--headless", "--size", "640x480"],
        createCommand({ signal: controller.signal }),
    );
    try {
        await Promise.race([
            expect.poll(() => existsSync(readyPath), { timeout: 60_000 }).toBe(true),
            running.then(() => {
                throw new Error("Session ended before loading the application");
            }),
        ]);
        await verify();
    } finally {
        controller.abort();
        await running;
    }
};

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("CLI commands", () => {
    it("builds a project and protects files outside the requested output directory", async () => {
        using project = createProject();
        const output = await invoke(["build", "--cwd", project.root]);
        expect(output).toContain("Build complete");
        expect(readFileSync(join(project.root, "dist/bundle.mjs"), "utf8")).toContain("hello from build");
        project.write("keep.txt", "keep");
        await expect(invoke(["build", "--cwd", project.root, "--out", "../outside"])).rejects.toThrow();
        expect(readFileSync(join(project.root, "keep.txt"), "utf8")).toBe("keep");
    });

    it("generates upstream bindings and documentation through their command arguments", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"] });
        expect(await invoke(["codegen", "--cwd", project.root])).toContain("codegen");
        expect(existsSync(join(project.root, "node_modules/@gtkx/gi/gio/index.d.ts"))).toBe(true);
        await invoke(["docs", "--cwd", project.root, "--out", "reference"]);
        const files = readdirSync(join(project.root, "reference"), { recursive: true });
        expect(files.some((file) => file.toString().endsWith(".md"))).toBe(true);
        await expect(invoke(["docs", "--cwd", project.root, "--out", "../outside"])).rejects.toThrow("below");
    });

    it("creates a project through the gtkx create alias", async () => {
        using project = createProject();
        const target = join(project.root, "created");
        await invoke(["create", target, "--no-interactive", "--skip-install", "--application-id", "org.gtkx.created"]);
        expect(JSON.parse(readFileSync(join(target, "package.json"), "utf8"))).toHaveProperty("name", "created");
    });

    it("previews and removes stale compile caches without touching unrelated directories", async () => {
        using project = createProject();
        vi.stubEnv("XDG_CACHE_HOME", project.root);
        const stale = join(project.root, "gtkx/compile-cache/v0.0.0-x64-old");
        mkdirSync(stale, { recursive: true });
        project.write("unrelated/keep.txt", "keep");
        await invoke(["cleanup", "--dry-run"]);
        expect(existsSync(stale)).toBe(true);
        await invoke(["cleanup"]);
        expect(existsSync(stale)).toBe(false);
        expect(existsSync(join(project.root, "unrelated/keep.txt"))).toBe(true);
    });

    it("writes editor MCP configuration and preserves other registered servers", async () => {
        using project = createProject();
        project.write(".mcp.json", '{"mcpServers":{"other":{"command":"other"}}}');
        await invoke(["mcp", "init", "--cwd", project.root, "--client", "claude"]);
        expect(JSON.parse(readFileSync(join(project.root, ".mcp.json"), "utf8"))).toMatchObject({
            mcpServers: { other: { command: "other" }, gtkx: { command: "npx", args: ["gtkx", "mcp"] } },
        });
        await expect(invoke(["mcp", "init", "--cwd", project.root, "--client", "missing"])).rejects.toThrow();
    });

    it("runs an MCP server with parsed tool restrictions", async () => {
        using project = createProject();
        const controller = new AbortController();
        const [clientTransport, transport] = InMemoryTransport.createLinkedPair();
        const selected = createCommand({
            signal: controller.signal,
            transport,
            socketPath: join(project.root, "mcp.sock"),
        });
        const client = new Client({ name: "command-test", version: "1.0.0" });
        try {
            await invoke(["mcp", "--cwd", project.root, "--read-only"], selected);
            await client.connect(clientTransport);
            const tools = (await client.listTools()).tools.map((tool) => tool.name);
            expect(tools).toContain("gtkx_get_widget_tree");
            expect(tools).not.toContain("gtkx_click");
        } finally {
            controller.abort();
            await client.close();
            await expect.poll(() => existsSync(join(project.root, "mcp.sock"))).toBe(false);
        }
    });

    it("writes deployment manifests and stages a real built application", async () => {
        using project = createProject({
            deploy: {
                name: "CLI Example",
                summary: "Exercises the deployment command",
                categories: ["Utility"],
                description: ["An example application used to exercise real deployment output."],
                developer: { name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                homepage: "https://gtkx.dev",
                node: { source: "host", shouldStrip: false },
            },
        });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        const config = readFileSync(join(project.root, "gtkx.config.ts"), "utf8");
        project.write(
            "gtkx.config.ts",
            config.replace('"codegen":false', '"codegen":false,"applicationIcon":"icon.svg"'),
        );
        await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "appimage,deb,flatpak,rpm"]);
        const files = readdirSync(join(project.root, "build"), { recursive: true }).map(String);
        expect(files).toEqual(
            expect.arrayContaining([
                expect.stringContaining("targets/deb/nfpm.yaml"),
                expect.stringContaining("targets/rpm/nfpm.yaml"),
                expect.stringContaining("targets/flatpak/org.gtkx.example.yml"),
            ]),
        );
        expect(files.some((file) => file.endsWith("bundle.mjs"))).toBe(true);
    });

    it("starts, refreshes source and configuration, and stops a real dev session", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const application = (revision: string) => `import { Application } from "@gtkx/gi/gio";
            import { applicationId } from "virtual:gtkx-config";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId });
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(readyPath)}, ${JSON.stringify(revision)} + ":" + applicationId);`;
        project.write("src/index.ts", application("initial"));
        await withSession("dev", project.root, readyPath, async () => {
            project.write("src/index.ts", application("updated"));
            await expect
                .poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 })
                .toBe("updated:org.gtkx.example");
            const configPath = join(project.root, "gtkx.config.ts");
            project.write(
                "gtkx.config.ts",
                readFileSync(configPath, "utf8").replace("org.gtkx.example", "org.gtkx.reloaded"),
            );
            await expect
                .poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 })
                .toBe("updated:org.gtkx.reloaded");
        });
    });

    it("starts a real storybook session and stops its application", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        project.write(
            "src/example.stories.ts",
            `import { writeFileSync } from "node:fs";
            writeFileSync(${JSON.stringify(readyPath)}, "ready");
            export default { title: "Example" }; export const Empty = { render: () => null };`,
        );
        await withSession("storybook", project.root, readyPath, () => {
            expect(readFileSync(readyPath, "utf8")).toBe("ready");
            return Promise.resolve();
        });
    });

    it("reports actionable deployment configuration errors", async () => {
        using project = createProject();
        await expect(invoke(["deploy", "--cwd", project.root, "--print-manifests"])).rejects.toThrow("deploy");
    });

    it.each(["dev", "storybook"])("validates %s headless arguments before starting a session", async (name) => {
        using project = createProject();
        const controller = new AbortController();
        await expect(
            invoke([name, "--cwd", project.root, "--size", "640x480"], createCommand({ signal: controller.signal })),
        ).rejects.toThrow("--headless");
    });
});
