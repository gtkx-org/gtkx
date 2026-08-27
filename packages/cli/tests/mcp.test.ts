import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli, STORE_LIBRARIES } from "./cli-project.js";

type ServerEntry = { command?: string; args?: string[]; type?: string };
type ClientDocument = Record<string, Record<string, ServerEntry> | undefined>;

const APPLICATION_ID = "com.gtkx.climcp";
const ENTRY = { command: "npx", args: ["gtkx", "mcp"] };

const config = (): string =>
    `export default { applicationId: "${APPLICATION_ID}", libraries: ${JSON.stringify(STORE_LIBRARIES)} };\n`;

const readJson = (project: CliProject, name: string): ClientDocument =>
    JSON.parse(readFileSync(join(project.root, name), "utf8")) as ClientDocument;

const init = (project: CliProject, client: string): number | null =>
    runCli(project, ["mcp", "init", "--client", client]).status;

describe("gtkx mcp init", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

    beforeAll(() => {
        state.project = createCliProject({ prefix: "gtkx-cli-mcp-", config: config() });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes the server into the file each editor reads", () => {
        expect(init(state.project, "claude")).toBe(0);
        expect(init(state.project, "cursor")).toBe(0);
        expect(init(state.project, "vscode")).toBe(0);
        expect(readJson(state.project, ".mcp.json").mcpServers?.gtkx).toEqual(ENTRY);
        expect(readJson(state.project, join(".cursor", "mcp.json")).mcpServers?.gtkx).toEqual(ENTRY);

        expect(readJson(state.project, join(".vscode", "mcp.json")).servers?.gtkx).toEqual({
            type: "stdio",
            ...ENTRY,
        });
    });

    it("keeps the other servers already configured in the file", () => {
        const path = join(state.project.root, ".mcp.json");
        writeFileSync(path, `${JSON.stringify({ mcpServers: { other: { command: "other" } } }, null, 4)}\n`);
        expect(init(state.project, "claude")).toBe(0);
        const servers = readJson(state.project, ".mcp.json").mcpServers;
        expect(servers?.other).toEqual({ command: "other" });
        expect(servers?.gtkx).toEqual(ENTRY);
    });

    it("prints the snippet for an editor whose config lives outside the project", () => {
        const run = runCli(state.project, ["mcp", "init", "--client", "codex"]);
        expect(run.status).toBe(0);
        expect(run.output).toContain("[mcp_servers.gtkx]");
    });

    it("rejects an editor it does not know", () => {
        expect(init(state.project, "notepad")).not.toBe(0);
    });
});
