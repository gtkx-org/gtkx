import { vol } from "memfs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeBuildAllowance } from "../src/build-allowance.js";

const TEST_DIR = "/test-workspace";
const WORKSPACE_FILE = `${TEST_DIR}/pnpm-workspace.yaml`;
const EXPECTED_WORKSPACE = "packages:\n  - '.'\nallowBuilds:\n  '@swc/core': true\n  esbuild: true\n";

function read(path: string): string {
    return vol.readFileSync(path, "utf8") as string;
}

vi.mock("node:fs", async () => {
    const memfs = await vi.importActual<typeof import("memfs")>("memfs");

    return { ...memfs.fs, default: memfs.fs };
});

beforeEach(() => {
    vol.reset();
    vol.mkdirSync(TEST_DIR, { recursive: true });
});

describe("writeBuildAllowance (pnpm)", () => {
    it("writes the packages selection alongside the built dependencies", () => {
        writeBuildAllowance(TEST_DIR, "pnpm");
        expect(read(WORKSPACE_FILE)).toBe(EXPECTED_WORKSPACE);
    });

    it("replaces an existing pnpm-workspace.yaml instead of appending a second allowBuilds key", () => {
        vol.writeFileSync(WORKSPACE_FILE, "packages:\n  - '.'\nallowBuilds:\n  my-tool: true\n");
        writeBuildAllowance(TEST_DIR, "pnpm");
        const content = read(WORKSPACE_FILE);
        expect(content.match(/^allowBuilds:/gm)).toHaveLength(1);
        expect(content).toBe(EXPECTED_WORKSPACE);
    });
});
