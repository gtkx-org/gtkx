import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DeployConfig, DeployScreenshot } from "../../../src/deploy/types.js";
import { resolveScreenshots } from "../../../src/deploy/settings/screenshots.js";

const MISSING_ROOT = "/nonexistent-gtkx-test";
const BASE = "https://cdn.example.com/shots";
const GITHUB_REMOTE = "https://github.com/gtkx-org/gtkx.git";
const GITHUB_RAW = "https://raw.githubusercontent.com/gtkx-org/gtkx/main";
const state: { roots: string[] } = { roots: [] };

const resolve = (deploy: DeployConfig, root: string = MISSING_ROOT): DeployScreenshot[] =>
    resolveScreenshots({ root, deploy });

const screenshotUrls = (screenshots: DeployScreenshot[]): string[] =>
    screenshots.map((screenshot) => screenshot.url);

const composeWithBase = (file: string, base: string = BASE): string | undefined =>
    resolve({ screenshots: [{ file }], screenshotBaseUrl: base })[0]?.url;

const resolveDefaultFlags = (...flags: (boolean | undefined)[]): boolean[] =>
    resolve({ screenshots: flags.map((isDefault) => ({ url: "https://x.dev/a.png", isDefault })) }).map(
        (screenshot) => screenshot.isDefault,
    );

const resolveWithoutBase = (): DeployScreenshot[] => resolve({ screenshots: [{ file: "data/one.png" }] });

const createRepository = (remote: string): string => {
    const git = resolveExecutable("git");
    const root = mkdtempSync(join(tmpdir(), "gtkx-screenshots-"));
    state.roots.push(root);
    execFileSync(git, ["init", "-q"], { cwd: root, stdio: "ignore" });
    execFileSync(git, ["remote", "add", "origin", remote], { cwd: root, stdio: "ignore" });

    return root;
};

const urlFromRemote = (remote: string, rel = ""): string | undefined => {
    const root = join(createRepository(remote), rel);
    mkdirSync(root, { recursive: true });

    return resolve({ screenshots: [{ file: "data/one.png" }] }, root)[0]?.url;
};

const urlFromDefaultBranch = (branch: string): string | undefined => {
    const root = createRepository(GITHUB_REMOTE);
    const args = ["symbolic-ref", "refs/remotes/origin/HEAD", `refs/remotes/origin/${branch}`];
    execFileSync(resolveExecutable("git"), args, { cwd: root, stdio: "ignore" });

    return resolve({ screenshots: [{ file: "data/one.png" }] }, root)[0]?.url;
};

afterEach(() => {
    for (const root of state.roots) {
        rmSync(root, { recursive: true, force: true });
    }

    state.roots = [];
});

describe("resolveScreenshots — configured urls", () => {
    it("passes an absolute url through unchanged", () => {
        const screenshots = resolve({ screenshots: [{ url: "https://example.com/one.png" }] });
        expect(screenshotUrls(screenshots)).toEqual(["https://example.com/one.png"]);
    });

    it("prefers the url over the file", () => {
        const entry = { url: "https://example.com/one.png", file: "data/one.png" };
        expect(resolve({ screenshots: [entry], screenshotBaseUrl: BASE })[0]?.url).toBe("https://example.com/one.png");
    });

    it("needs no base url when every entry carries a url", () => {
        expect(() => resolve({ screenshots: [{ url: "https://example.com/one.png" }] })).not.toThrow();
    });

    it("keeps a configured caption", () => {
        const screenshots = resolve({ screenshots: [{ url: "https://example.com/one.png", caption: "Browsing" }] });
        expect(screenshots[0]?.caption).toBe("Browsing");
    });

    it("turns a missing caption into null", () => {
        expect(resolve({ screenshots: [{ url: "https://example.com/one.png" }] })[0]?.caption).toBeNull();
    });
});

describe("resolveScreenshots — empty input", () => {
    it("returns an empty list for an empty screenshots array", () => {
        expect(resolve({ screenshots: [] })).toEqual([]);
    });

    it("returns an empty list when no screenshots are configured", () => {
        expect(resolve({})).toEqual([]);
    });

    it("derives no base url when there is nothing to resolve", () => {
        expect(() => resolve({ screenshots: [] })).not.toThrow();
    });
});

describe("resolveScreenshots — base url composition", () => {
    it("joins the base url and the file", () => {
        expect(composeWithBase("data/one.png")).toBe("https://cdn.example.com/shots/data/one.png");
    });

    it("removes a trailing slash from the base url", () => {
        expect(composeWithBase("one.png", `${BASE}/`)).toBe("https://cdn.example.com/shots/one.png");
    });

    it("removes every trailing slash from the base url", () => {
        expect(composeWithBase("one.png", `${BASE}///`)).toBe("https://cdn.example.com/shots/one.png");
    });

    it("removes a leading dot slash from the file", () => {
        expect(composeWithBase("./data/one.png")).toBe("https://cdn.example.com/shots/data/one.png");
    });

    it("removes a leading slash from the file", () => {
        expect(composeWithBase("/data/one.png")).toBe("https://cdn.example.com/shots/data/one.png");
    });

    it("removes a leading dot slash and the slash it hides", () => {
        expect(composeWithBase(".//data/one.png")).toBe("https://cdn.example.com/shots/data/one.png");
    });

    it("leaves an entry with neither url nor file pointing at the bare base url", () => {
        expect(resolve({ screenshots: [{}], screenshotBaseUrl: BASE })[0]?.url).toBe(`${BASE}/`);
    });
});

describe("resolveScreenshots — the default screenshot", () => {
    it("marks only the first entry that asks to be the default", () => {
        expect(resolveDefaultFlags(false, true, true)).toEqual([false, true, false]);
    });

    it("marks no entry when none asks to be the default", () => {
        expect(resolveDefaultFlags(false, undefined)).toEqual([false, false]);
    });

    it("marks the single entry when it asks to be the default", () => {
        expect(resolveDefaultFlags(true)).toEqual([true]);
    });

    it("marks nothing for a lone entry that does not ask", () => {
        expect(resolveDefaultFlags(undefined)).toEqual([false]);
    });
});

describe("resolveScreenshots — a file with no base url", () => {
    it("names the setting that would fix it", () => {
        expect(resolveWithoutBase).toThrow("deploy.screenshotBaseUrl");
    });

    it("names the per-screenshot escape hatch", () => {
        expect(resolveWithoutBase).toThrow(/`url`/);
    });

    it("names the screenshot it could not resolve", () => {
        expect(resolveWithoutBase).toThrow(/data\/one\.png/);
    });

    it("explains why a local path is not enough", () => {
        expect(resolveWithoutBase).toThrow("software center");
    });

    it("fails even when an earlier entry carries a url", () => {
        const screenshots = [{ url: "https://x.dev/a.png" }, { file: "b.png" }];
        expect(() => resolve({ screenshots })).toThrow("Cannot turn the screenshot \"b.png\" into a URL");
    });
});

describe("resolveScreenshots — derived from the git remote", () => {
    it("derives a raw base url from an https github remote", () => {
        expect(urlFromRemote(GITHUB_REMOTE)).toBe(`${GITHUB_RAW}/data/one.png`);
    });

    it("derives a raw base url from an ssh github remote", () => {
        expect(urlFromRemote("git@github.com:gtkx-org/gtkx.git")).toBe(`${GITHUB_RAW}/data/one.png`);
    });

    it("keeps working when the remote has no git suffix", () => {
        expect(urlFromRemote("https://github.com/gtkx-org/gtkx")).toBe(`${GITHUB_RAW}/data/one.png`);
    });

    it("derives a raw base url from a gitlab remote", () => {
        expect(urlFromRemote("https://gitlab.com/gtkx-org/gtkx.git")).toBe(
            "https://gitlab.com/gtkx-org/gtkx/-/raw/main/data/one.png",
        );
    });

    it("follows the default branch the origin remote names", () => {
        expect(urlFromDefaultBranch("master")).toBe(
            "https://raw.githubusercontent.com/gtkx-org/gtkx/master/data/one.png",
        );
    });
});

describe("resolveScreenshots — remotes that yield no base url", () => {
    it("rejects a host it has no raw url scheme for", () => {
        expect(() => urlFromRemote("https://git.example.com/gtkx-org/gtkx.git")).toThrow("deploy.screenshotBaseUrl");
    });

    it("rejects a remote with extra path segments", () => {
        expect(() => urlFromRemote("https://github.com/gtkx-org/group/gtkx.git")).toThrow("deploy.screenshotBaseUrl");
    });

    it("rejects a remote with too few path segments", () => {
        expect(() => urlFromRemote("https://github.com/gtkx")).toThrow("deploy.screenshotBaseUrl");
    });

    it("lets an explicit base url win over the remote", () => {
        const deploy = { screenshots: [{ file: "one.png" }], screenshotBaseUrl: BASE };
        expect(resolve(deploy, createRepository(GITHUB_REMOTE))[0]?.url).toBe(`${BASE}/one.png`);
    });
});

describe("resolveScreenshots — a project below the repository root", () => {
    it("appends the path from the repository root to the base url", () => {
        expect(urlFromRemote(GITHUB_REMOTE, "examples/tutorial")).toBe(
            `${GITHUB_RAW}/examples/tutorial/data/one.png`,
        );
    });

    it("appends a single directory the same way", () => {
        expect(urlFromRemote(GITHUB_REMOTE, "app")).toBe(`${GITHUB_RAW}/app/data/one.png`);
    });
});
