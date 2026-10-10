import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, onTestFinished, test } from "vitest";
import { publishPackage } from "./release-package.ts";

type RegistryDocument = { "dist-tags": Record<string, string>; versions: Record<string, unknown> };

const ROOT = join(import.meta.dirname, "..");
const run = promisify(execFile);

const registryFixture = async (version = "1.0.0") => {
    const directory = mkdtempSync(join(tmpdir(), "gtkx-release-"));
    onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
    const state: {
        document: RegistryDocument | undefined;
        exceptions: Map<string, RegistryDocument | undefined>;
        requests: { method: string; name: string }[];
    } = {
        document: { "dist-tags": { latest: version }, versions: { [version]: {} } },
        exceptions: new Map(),
        requests: [],
    };
    const registry = createServer((request, response) => {
        const name = decodeURIComponent((request.url ?? "").slice(1));
        state.requests.push({ method: request.method ?? "", name });
        response.setHeader("Content-Type", "application/json");

        if (request.method === "PUT") {
            const chunks: Buffer[] = [];
            request.on("data", (chunk: Buffer) => chunks.push(chunk));
            request.on("end", () => {
                state.document = JSON.parse(Buffer.concat(chunks).toString()) as RegistryDocument;
                response.writeHead(201).end(JSON.stringify({ ok: true }));
            });

            return;
        }

        const document = state.exceptions.has(name) ? state.exceptions.get(name) : state.document;
        response.writeHead(document === undefined ? 404 : 200).end(JSON.stringify(document ?? {}));
    });
    registry.listen(0, "127.0.0.1");
    await once(registry, "listening");
    onTestFinished(() => {
        registry.closeAllConnections();
        registry.close();
    });
    const address = registry.address();

    if (address === null || typeof address === "string") {
        throw new Error("Registry fixture has no port");
    }

    const url = `http://127.0.0.1:${String(address.port)}/`;
    const manifest = {
        name: "@gtkx/release-fixture",
        version,
        publishConfig: { registry: url },
        files: ["index.js"],
    };
    writeFileSync(join(directory, "package.json"), JSON.stringify(manifest));
    writeFileSync(join(directory, "index.js"), "export const released = true;\n");

    return { directory, manifest, state, url };
};

test("retries skip published packages and preserve their prerelease channel", async () => {
    const { directory, state } = await registryFixture("1.0.0-beta.2");
    state.document = {
        "dist-tags": { latest: "0.9.0", beta: "1.0.0-beta.2" },
        versions: { "0.9.0": {}, "1.0.0-beta.2": {} },
    };

    await publishPackage(directory, 1000);

    expect(state.requests.length).toBeGreaterThan(0);
    expect(state.requests.every(({ method }) => method === "GET")).toBe(true);
});

test.each([undefined, "0.9.0"])("retries fail when an existing version has channel %s", async (tag) => {
    const { directory, state } = await registryFixture();
    state.document = { "dist-tags": tag === undefined ? {} : { latest: tag }, versions: { "1.0.0": {} } };

    await expect(publishPackage(directory, 50)).rejects.toThrow("within 50 ms");

    expect(state.requests.every(({ method }) => method === "GET")).toBe(true);
});

test("publication refuses a newer channel before uploading", async () => {
    const { directory, state } = await registryFixture();
    state.document = { "dist-tags": { latest: "2.0.0" }, versions: { "2.0.0": {} } };

    await expect(publishPackage(directory, 1000)).rejects.toThrow("channel backwards");

    expect(state.requests).toEqual([{ method: "GET", name: "@gtkx/release-fixture" }]);
});

test("publication honors scoped registry configuration", async () => {
    const { directory, manifest, state, url } = await registryFixture();
    const { publishConfig: _publishConfig, ...unconfigured } = manifest;
    writeFileSync(join(directory, "package.json"), JSON.stringify(unconfigured));
    writeFileSync(join(directory, ".npmrc"), `@gtkx:registry=${url}\n`);

    await publishPackage(directory, 1000);

    expect(state.requests.length).toBeGreaterThan(0);
    expect(state.requests.every(({ method }) => method === "GET")).toBe(true);
});

test("the package command publishes with pnpm and verifies registry visibility", async () => {
    const { directory, state, url } = await registryFixture();
    state.document = undefined;
    writeFileSync(join(directory, ".npmrc"), `//${new URL(url).host}/:_authToken=fixture-token\n`);

    await run(process.execPath, [join(ROOT, "scripts/release-package.ts")], {
        cwd: directory,
        env: { ...process.env, NPM_CONFIG_PROVENANCE: "false", GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS: "1000" },
        timeout: 30_000,
    });

    const published = (await fetch(new URL(encodeURIComponent("@gtkx/release-fixture"), url)).then((response) =>
        response.json(),
    )) as RegistryDocument;

    expect(state.requests.some(({ method }) => method === "PUT")).toBe(true);
    expect(published["dist-tags"].latest).toBe("1.0.0");
    expect(published.versions["1.0.0"]).toBeDefined();
}, 35_000);

test("Node alone verifies the complete release before GitHub publication", async () => {
    const { version } = JSON.parse(readFileSync(join(ROOT, "packages/create-gtkx/package.json"), "utf8")) as {
        version: string;
    };
    const { state, url } = await registryFixture(version);
    const tag = version.includes("-") ? version.split("-")[1]?.split(".")[0] : "latest";

    if (tag === undefined) {
        throw new Error("Release fixture has no channel");
    }

    state.document = { "dist-tags": { [tag]: version }, versions: { [version]: {} } };
    const args = [join(ROOT, "scripts/release.ts"), "--verify-only"];
    const options = { env: { ...process.env, NPM_CONFIG_REGISTRY: url }, timeout: 10_000 };

    await run(process.execPath, args, options);

    expect(state.requests.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
            "@gtkx/native-linux-x64-gnu",
            "@gtkx/native-linux-arm64-gnu",
            "create-gtkx",
            "@gtkx/vitest",
        ]),
    );
    state.exceptions.set("@gtkx/vitest", undefined);
    await expect(run(process.execPath, args, options)).rejects.toThrow("@gtkx/vitest");
    state.exceptions.set("@gtkx/vitest", { "dist-tags": { [tag]: "99.0.0" }, versions: { [version]: {} } });
    await expect(run(process.execPath, args, options)).rejects.toThrow("@gtkx/vitest");
    expect(state.requests.every(({ method }) => method === "GET")).toBe(true);
});
