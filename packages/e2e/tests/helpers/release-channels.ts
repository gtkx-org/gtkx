import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PackageManifest } from "../../../../scripts/publish-manifest.js";
import { REGISTRY, ROOT_DIR, runAsync } from "./registry.js";

const NAMES = ["@gtkx/channel-e2e-a", "@gtkx/channel-e2e-b"] as const;

type RegistryDocument = {
    "dist-tags": Record<string, string>;
    versions: Record<string, unknown>;
};

const preparePackages = (root: string, version: string): [string, string] => {
    const rootManifest = JSON.parse(readFileSync(join(ROOT_DIR, "package.json"), "utf8")) as PackageManifest;
    const packageManager = rootManifest.packageManager;
    assert.equal(typeof packageManager, "string");
    const prepare = (suffix: string): string => {
        const directory = join(root, `channel-${version}-${suffix}`);
        const name = `@gtkx/channel-e2e-${suffix}`;
        mkdirSync(directory, { recursive: true });
        const manifest = { name, version, packageManager, files: ["index.js"] };
        writeFileSync(join(directory, "package.json"), `${JSON.stringify(manifest)}\n`);
        writeFileSync(join(directory, "index.js"), `module.exports = ${JSON.stringify(version)};\n`);

        return directory;
    };

    return [prepare("a"), prepare("b")];
};

const registryDocument = async (name: string): Promise<RegistryDocument> => {
    const response = await fetch(`${REGISTRY}${encodeURIComponent(name)}`);
    assert.equal(response.status, 200);

    return (await response.json()) as RegistryDocument;
};

const assertChannels = async (beta: string | undefined): Promise<void> => {
    for (const name of NAMES) {
        const document = await registryDocument(name);
        assert.equal(document["dist-tags"].latest, "0.0.1");
        assert.equal(document["dist-tags"].rc, "0.1.0-rc.1");
        assert.equal(document["dist-tags"].beta, beta);
    }
};

const verifyChannelConsumer = async (root: string, env: NodeJS.ProcessEnv): Promise<void> => {
    const consumer = join(root, "channel-consumer");
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(consumer, "package.json"), '{"private":true}\n');
    await runAsync(
        "npm",
        ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...NAMES.map((name) => `${name}@beta`)],
        { cwd: consumer, env },
    );

    for (const name of NAMES) {
        const manifestPath = join(consumer, "node_modules", name, "package.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
        assert.equal(manifest.version, "0.2.0-beta.1");
    }
};

const verifyMisplacedTagRetry = async (directory: string, env: NodeJS.ProcessEnv): Promise<void> => {
    const name = NAMES[0];
    await runAsync("npm", ["dist-tag", "add", `${name}@0.1.0-beta.1`, "beta", "--registry", REGISTRY], { env });
    await assert.rejects(
        runAsync("tsx", [join(ROOT_DIR, "scripts", "release-package.ts")], {
            cwd: directory,
            env: { ...env, GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS: "2000" },
        }),
    );
    const document = await registryDocument(name);
    assert.equal(document["dist-tags"].beta, "0.1.0-beta.1");
    assert.equal(document["dist-tags"].latest, "0.0.1");
    assert.equal(document["dist-tags"].rc, "0.1.0-rc.1");
    await assert.rejects(
        runAsync("node", [join(ROOT_DIR, "scripts", "verify-release-channel.ts"), "0.2.0-beta.1", directory], { env }),
    );
};

const verifyReleaseChannels = async (root: string, env: NodeJS.ProcessEnv): Promise<void> => {
    const baseline = preparePackages(root, "0.0.1");
    const rc = preparePackages(root, "0.1.0-rc.1");
    const older = preparePackages(root, "0.1.0-beta.1");
    const unpublished = preparePackages(root, "0.1.0-beta.2");
    const newer = preparePackages(root, "0.2.0-beta.1");
    const publish = async (directory: string): Promise<void> => {
        await runAsync("tsx", [join(ROOT_DIR, "scripts", "release-package.ts")], { cwd: directory, env });
    };
    const verify = async (version: string, directories: string[]): Promise<void> => {
        await runAsync("node", [join(ROOT_DIR, "scripts", "verify-release-channel.ts"), version, ...directories], {
            env,
        });
    };

    await publish(baseline[0]);
    await publish(baseline[1]);
    await publish(rc[0]);
    await publish(rc[1]);
    await assertChannels(undefined);
    await publish(older[0]);
    await assert.rejects(verify("0.1.0-beta.1", older));
    await publish(older[0]);
    await publish(older[1]);
    await verify("0.1.0-beta.1", older);
    await assertChannels("0.1.0-beta.1");
    await publish(newer[0]);
    await assert.rejects(verify("0.2.0-beta.1", newer));
    await assert.rejects(verify("0.1.0-beta.1", older));
    await publish(newer[1]);
    await publish(newer[0]);
    await publish(newer[1]);

    for (const directory of [...older, ...unpublished]) {
        await assert.rejects(publish(directory));
    }

    for (const name of NAMES) {
        const document = await registryDocument(name);
        assert.equal(document.versions["0.1.0-beta.2"], undefined);
    }

    await assertChannels("0.2.0-beta.1");
    await verify("0.2.0-beta.1", newer);
    await verifyChannelConsumer(root, env);
    await verifyMisplacedTagRetry(newer[0], env);
};

export { verifyReleaseChannels };
