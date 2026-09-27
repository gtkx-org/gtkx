import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PackageManifest } from "./publish-manifest.js";
import { REGISTRY, ROOT_DIR, runAsync } from "./e2e-registry.js";

const NAMES = ["@gtkx/channel-e2e-a", "@gtkx/channel-e2e-b"];

const preparePackages = (root: string, version: string): [string, string] => {
    const prepare = (suffix: string): string => {
        const directory = join(root, `channel-${version}-${suffix}`);
        const name = `@gtkx/channel-e2e-${suffix}`;
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, "package.json"), `${JSON.stringify({ name, version, files: ["index.js"] })}\n`);
        writeFileSync(join(directory, "index.js"), `module.exports = ${JSON.stringify(version)};\n`);

        return directory;
    };

    return [prepare("a"), prepare("b")];
};

const assertChannels = async (version: string): Promise<void> => {
    for (const name of NAMES) {
        const response = await fetch(`${REGISTRY}${encodeURIComponent(name)}`);
        const document = response.ok ? await response.json() as { "dist-tags": Record<string, string> } : undefined;
        assert.equal(document?.["dist-tags"].latest, version);
    }
};

const verifyChannelConsumer = async (root: string, env: NodeJS.ProcessEnv): Promise<void> => {
    const consumer = join(root, "channel-consumer");
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(consumer, "package.json"), '{"private":true}\n');
    await runAsync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...NAMES], { cwd: consumer, env });

    for (const name of NAMES) {
        const manifestPath = join(consumer, "node_modules", name, "package.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
        assert.equal(manifest.version, "0.2.0");
    }
};

const verifyReleaseChannels = async (root: string, env: NodeJS.ProcessEnv): Promise<void> => {
    const baseline = preparePackages(root, "0.0.1");
    const older = preparePackages(root, "0.1.0");
    const newer = preparePackages(root, "0.2.0");
    const publish = async (directory: string): Promise<void> => {
        await runAsync("tsx", [join(ROOT_DIR, "scripts", "release-package.ts")], { cwd: directory, env });
    };
    const promote = async (directories: string[]): Promise<void> => {
        await runAsync("tsx", [join(ROOT_DIR, "scripts", "promote-release.ts"), ...directories], {
            env: { ...env, GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS: "2000" },
        });
    };

    await publish(baseline[0]);
    await publish(baseline[1]);
    await promote(baseline);
    await publish(older[0]);
    await publish(newer[0]);
    await assert.rejects(promote(newer));
    await assertChannels("0.0.1");
    await publish(newer[1]);
    await promote(newer);
    await promote(newer);
    await publish(older[1]);
    await assert.rejects(promote(older));
    await assert.rejects(runAsync("tsx", [
        join(ROOT_DIR, "scripts", "promote-release.ts"), "--check-only", ...older,
    ], { env }));
    await assertChannels("0.2.0");
    await runAsync("node", [join(ROOT_DIR, "scripts", "verify-release-channel.ts"), "0.2.0", ...newer], { env });
    await assert.rejects(runAsync("node", [
        join(ROOT_DIR, "scripts", "verify-release-channel.ts"), "0.1.0", ...older,
    ], { env }));
    await verifyChannelConsumer(root, env);
};

export { verifyReleaseChannels };
