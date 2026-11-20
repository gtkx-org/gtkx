import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommand } from "../dist/command.js";
import { createProject } from "./project.js";
import { invoke } from "./invoke.js";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("CLI commands", () => {
    it("rejects arguments after -- for commands that start no application", async () => {
        using project = createProject();

        await expect(
            invoke(["build", "--cwd", project.root], createCommand({ applicationArgs: ["--out", "build/helper"] })),
        ).rejects.toThrow();
        expect(existsSync(join(project.root, "dist"))).toBe(false);
    });

    it("points a document passed as the entry to application arguments", async () => {
        using project = createProject();
        project.write("COMMIT_EDITMSG", "# Please enter the commit message\n");

        await expect(invoke(["dev", "--cwd", project.root, "COMMIT_EDITMSG"])).rejects.toThrow(
            "gtkx dev -- COMMIT_EDITMSG",
        );
    });

    it("rejects options a command does not define, naming the closest one it does", async () => {
        using project = createProject();

        await expect(invoke(["deploy", "--cwd", project.root, "--targets=deb", "--print-manifests"])).rejects.toThrow(
            "Unknown option for gtkx deploy: --targets (did you mean --target?)",
        );
        await expect(invoke(["build", "--cwd", project.root, "--outt", "dist-x"])).rejects.toThrow(
            "--outt (did you mean --out?). gtkx build takes --cwd, --config and --out",
        );
        await expect(invoke(["mcp", "init", "--cwd", project.root, "--client", "claude", "--global"])).rejects.toThrow(
            "Unknown option for gtkx mcp init: --global. gtkx mcp init takes --client and --cwd",
        );
        await expect(invoke(["dev", "--cwd", project.root, "--headles", "notes.txt"])).rejects.toThrow(
            '--headles (did you mean --headless?). gtkx dev takes --cwd, --config, --headless and --size; run "gtkx dev --help" for details. To pass "--headles" to the application, put it after "--"',
        );
        expect(readdirSync(project.root).toSorted()).toEqual(["gtkx.config.ts", "node_modules", "package.json", "src"]);
    });

    it("accepts the spellings of defined options and names the running command for a stray entry", async () => {
        using project = createProject();
        vi.stubEnv("XDG_CACHE_HOME", project.root);
        project.write("notes.txt", "");

        await invoke(["cleanup", "--dryRun", "--no-dry-run"]);
        await expect(invoke(["dev", "--cwd", project.root, "notes.txt", "--", "--anything"])).rejects.toThrow(
            '"gtkx dev -- notes.txt"',
        );
        await expect(invoke(["build", "--cwd", project.root, "notes.txt"])).rejects.toThrow(
            `Application entry must be a JavaScript or TypeScript module: ${join(project.root, "notes.txt")}. gtkx build takes no application arguments.`,
        );
    });

    it.each(["dev", "build", "deploy"])("requires an application ID to %s a project", async (name) => {
        using project = createProject();
        project.write("gtkx.config.ts", `export default ${JSON.stringify({ codegen: false })};`);
        await expect(invoke([name, "--cwd", project.root])).rejects.toThrow(
            "is required to run, build or deploy an application",
        );
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
        project.write(
            ".mcp.json",
            '{"mcpServers":{"other":{"command":"other"},"gtkx":{"command":"npx","args":["gtkx","mcp"]}}}',
        );
        await invoke(["mcp", "init", "--cwd", project.root, "--client", "claude"]);
        expect(JSON.parse(readFileSync(join(project.root, ".mcp.json"), "utf8"))).toEqual({
            mcpServers: { other: { command: "other" }, gtkx: { command: "npx", args: ["--no", "gtkx", "mcp"] } },
        });
        await expect(invoke(["mcp", "init", "--cwd", project.root, "--client", "missing"])).rejects.toThrow();
    });

    it("keeps an editor MCP configuration's indentation and prints the server for one with comments", async () => {
        using project = createProject();
        const path = join(project.root, ".vscode/mcp.json");
        const init = () => invoke(["mcp", "init", "--cwd", project.root, "--client", "vscode"]);
        const commented = '{\n\t// Team servers\n\t"servers": {}\n}\n';
        project.write(".vscode/mcp.json", commented);

        const output = await init();
        expect(readFileSync(path, "utf8")).toBe(commented);
        expect(output).toContain('"gtkx": {');

        project.write(".vscode/mcp.json", '{\n\t"servers": {}\n}\n');
        await init();
        expect(readFileSync(path, "utf8")).toBe(
            `${JSON.stringify({ servers: { gtkx: { type: "stdio", command: "npx", args: ["--no", "gtkx", "mcp"] } } }, null, "\t")}\n`,
        );
    });

    it("writes the Codex server into the project's .codex/config.toml and preserves other servers", async () => {
        using project = createProject();
        const path = join(project.root, ".codex/config.toml");
        const table = '[mcp_servers.gtkx]\ncommand = "npx"\nargs = ["--no","gtkx","mcp"]\n';
        const other = '[mcp_servers.other]\ncommand = "other"\n';
        const init = () => invoke(["mcp", "init", "--cwd", project.root, "--client", "codex"]);

        await init();
        expect(readFileSync(path, "utf8")).toBe(table);
        await init();
        expect(readFileSync(path, "utf8")).toBe(table);

        project.write(".codex/config.toml", `model = "o3"\n\n${other}`);
        await init();
        expect(readFileSync(path, "utf8")).toBe(`model = "o3"\n\n${other}\n${table}`);

        project.write(".codex/config.toml", `[mcp_servers.gtkx]\ncommand = "npx"\nargs = ["gtkx", "mcp"]\n\n${other}`);
        await init();
        expect(readFileSync(path, "utf8")).toBe(`${table}\n${other}`);
    });

    it("prints the Codex server when .codex/config.toml declares it in a form it cannot edit", async () => {
        using project = createProject();
        const path = join(project.root, ".codex/config.toml");
        const sources = [
            '[mcp_servers]\ngtkx = { command = "gtkx-mcp" }\n',
            '[mcp_servers.gtkx]\ncommand = "npx"\nargs = [\n    "gtkx",\n    "mcp",\n]\n',
            '[mcp_servers.gtkx.env]\nNODE_ENV = "development"\n',
            'mcp_servers = { other = { command = "other" } }\n',
        ];

        for (const source of sources) {
            project.write(".codex/config.toml", source);
            const output = await invoke(["mcp", "init", "--cwd", project.root, "--client", "codex"]);
            expect(readFileSync(path, "utf8")).toBe(source);
            expect(output).toContain('args = ["--no","gtkx","mcp"]');
        }
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

    it.each(["dev", "storybook"])("validates %s headless arguments before starting a session", async (name) => {
        using project = createProject();
        const controller = new AbortController();
        await expect(
            invoke([name, "--cwd", project.root, "--size", "640x480"], createCommand({ signal: controller.signal })),
        ).rejects.toThrow("--headless");
    });
});
