import { execFileSync } from "node:child_process";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    renameSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

type PublishedManifest = {
    optionalDependencies?: Record<string, string>;
};

type NativeTarget = {
    artifact: string;
    platform: string;
    triple: string;
};

type NativeProject = {
    logPath: string;
    packageDir: string;
    root: string;
};

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const PREPUBLISH_SCRIPT = join(WORKSPACE_ROOT, "scripts", "prepublish-native.ts");
const NAPI_BIN = join(WORKSPACE_ROOT, "packages", "native", "node_modules", ".bin");
const projects: string[] = [];

const TARGETS = {
    arm64: {
        artifact: "native.linux-arm64-gnu.node",
        platform: "linux-arm64-gnu",
        triple: "aarch64-unknown-linux-gnu",
    },
    x64: {
        artifact: "native.linux-x64-gnu.node",
        platform: "linux-x64-gnu",
        triple: "x86_64-unknown-linux-gnu",
    },
} satisfies Record<string, NativeTarget>;

const fakePublisher = (root: string): string => {
    const binDir = join(root, "bin");
    const executable = join(binDir, "pnpm");
    mkdirSync(binDir);

    writeFileSync(
        executable,
        [
            "#!/usr/bin/env node",
            'import { appendFileSync } from "node:fs";',
            "appendFileSync(process.env.PUBLISH_LOG, `${process.cwd()}\\n`);",
        ].join("\n"),
    );

    chmodSync(executable, 0o755);

    return binDir;
};

const corruptPackagedArtifact = (project: NativeProject, target: NativeTarget): void => {
    const executable = join(project.root, "bin", "napi");
    const realNapi = join(NAPI_BIN, "napi");
    const packagedArtifact = join(project.packageDir, "npm", target.platform, target.artifact);

    writeFileSync(
        executable,
        [
            "#!/usr/bin/env node",
            'import { readFileSync, writeFileSync } from "node:fs";',
            'import { spawnSync } from "node:child_process";',
            `const result = spawnSync(${JSON.stringify(realNapi)}, process.argv.slice(2), { stdio: "inherit" });`,
            "if (result.status !== 0) process.exit(result.status ?? 1);",
            'if (process.argv[2] === "artifacts") {',
            `    const path = ${JSON.stringify(packagedArtifact)};`,
            "    const contents = readFileSync(path);",
            "    contents.fill(contents[0] === 0 ? 1 : 0);",
            "    writeFileSync(path, contents);",
            "}",
        ].join("\n"),
    );

    chmodSync(executable, 0o755);
};

const linkPackagedPath = (
    project: NativeProject,
    target: NativeTarget,
    subject: "directory" | "license",
): void => {
    const executable = join(project.root, "bin", "napi");
    const realNapi = join(NAPI_BIN, "napi");
    const platformDir = join(project.packageDir, "npm", target.platform);
    const relocated = join(project.root, "linked-platform");
    const linkedLicense = join(platformDir, "LICENSE");

    const mutation = subject === "directory"
        ? [
                `    renameSync(path, ${JSON.stringify(relocated)});`,
                `    symlinkSync(${JSON.stringify(relocated)}, path, "dir");`,
            ]
        : [
                `    symlinkSync(${JSON.stringify(join(project.root, "LICENSE"))}, ` +
                `${JSON.stringify(linkedLicense)});`,
            ];

    writeFileSync(
        executable,
        [
            "#!/usr/bin/env node",
            'import { renameSync, symlinkSync } from "node:fs";',
            'import { spawnSync } from "node:child_process";',
            `const result = spawnSync(${JSON.stringify(realNapi)}, process.argv.slice(2), { stdio: "inherit" });`,
            "if (result.status !== 0) process.exit(result.status ?? 1);",
            'if (process.argv[2] === "artifacts") {',
            `    const path = ${JSON.stringify(platformDir)};`,
            ...mutation,
            "}",
        ].join("\n"),
    );

    chmodSync(executable, 0o755);
};

const createNativeProject = (
    targets: NativeTarget[],
    artifacts: NativeTarget[] = targets,
): NativeProject => {
    const root = mkdtempSync(join(WORKSPACE_ROOT, ".prepublish-native-"));
    const packageDir = join(root, "packages", "native");
    const artifactsDir = join(packageDir, "artifacts");
    projects.push(root);
    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(join(root, "LICENSE"), "fixture license\n");

    writeFileSync(
        join(packageDir, "package.json"),
        `${JSON.stringify(
            {
                name: "@gtkx/native-fixture",
                version: "1.4.0",
                license: "MPL-2.0",
                engines: { node: ">=24.11.0" },
                napi: {
                    binaryName: "native",
                    targets: targets.map((target) => target.triple),
                },
            },
            null,
            4,
        )}\n`,
    );

    for (const artifact of artifacts) {
        writeFileSync(join(artifactsDir, artifact.artifact), `${artifact.triple}\n`);
    }

    fakePublisher(root);

    return { logPath: join(root, "published.log"), packageDir, root };
};

const createStalePlatformPackage = (project: NativeProject, target: NativeTarget): void => {
    const directory = join(project.packageDir, "npm", target.platform);
    mkdirSync(directory, { recursive: true });

    writeFileSync(
        join(directory, "package.json"),
        `${JSON.stringify(
            {
                name: `@gtkx/native-fixture-${target.platform}`,
                version: "1.4.0",
                main: target.artifact,
                files: [target.artifact],
                license: "MPL-2.0",
                engines: { node: ">=24.11.0" },
            },
            null,
            4,
        )}\n`,
    );

    writeFileSync(join(directory, "README.md"), "stale platform\n");
};

const prepublish = (project: NativeProject): void => {
    const searchPath = [join(project.root, "bin"), NAPI_BIN, process.env.PATH ?? ""]
        .filter((entry) => entry.length > 0)
        .join(delimiter);

    execFileSync(process.execPath, ["--import", "tsx", PREPUBLISH_SCRIPT], {
        cwd: project.packageDir,
        env: { ...process.env, PATH: searchPath, PUBLISH_LOG: project.logPath },
        stdio: "pipe",
    });
};

const publishedPlatforms = (project: NativeProject): string[] =>
    readFileSync(project.logPath, "utf8")
        .trim()
        .split("\n")
        .map((path) => path.slice(path.lastIndexOf("/") + 1));

const publishedManifest = (project: NativeProject): PublishedManifest =>
    JSON.parse(readFileSync(join(project.packageDir, "package.json"), "utf8")) as PublishedManifest;

const expectPrepublishToThrow = (project: NativeProject): void => {
    expect(() => {
        prepublish(project);
    }).toThrow();
};

afterEach(() => {
    const currentProjects = [...projects];
    projects.length = 0;

    for (const root of currentProjects) {
        rmSync(root, { recursive: true, force: true });
    }
});

describe("native release publication", () => {
    it("publishes every configured platform and declares each dependency", () => {
        const project = createNativeProject([TARGETS.x64, TARGETS.arm64]);
        prepublish(project);
        expect(publishedPlatforms(project)).toEqual([TARGETS.arm64.platform, TARGETS.x64.platform]);

        expect(publishedManifest(project).optionalDependencies).toEqual({
            "@gtkx/native-fixture-linux-arm64-gnu": "1.4.0",
            "@gtkx/native-fixture-linux-x64-gnu": "1.4.0",
        });

        for (const target of [TARGETS.arm64, TARGETS.x64]) {
            expect(existsSync(join(project.packageDir, "npm", target.platform, "LICENSE"))).toBe(false);
        }
    });

    it("publishes only the configured host package when a stale directory remains", () => {
        const project = createNativeProject([TARGETS.x64]);
        const staleDir = join(project.packageDir, "npm", TARGETS.arm64.platform);
        mkdirSync(staleDir, { recursive: true });
        writeFileSync(join(staleDir, "package.json"), "{}\n");
        prepublish(project);
        expect(publishedPlatforms(project)).toEqual([TARGETS.x64.platform]);

        expect(publishedManifest(project).optionalDependencies).toEqual({
            "@gtkx/native-fixture-linux-x64-gnu": "1.4.0",
        });
    });

    it("throws when a configured platform artifact is missing", () => {
        const missing = createNativeProject([TARGETS.x64, TARGETS.arm64], [TARGETS.x64]);
        expectPrepublishToThrow(missing);
        const mismatched = createNativeProject([TARGETS.x64]);
        corruptPackagedArtifact(mismatched, TARGETS.x64);
        expectPrepublishToThrow(mismatched);

        for (const subject of ["directory", "license"] as const) {
            const linked = createNativeProject([TARGETS.x64]);
            linkPackagedPath(linked, TARGETS.x64, subject);
            expectPrepublishToThrow(linked);
        }

        const substituted = createNativeProject([TARGETS.x64], [TARGETS.arm64]);
        createStalePlatformPackage(substituted, TARGETS.arm64);
        expectPrepublishToThrow(substituted);
        const linkedManifest = createNativeProject([TARGETS.x64]);
        const manifest = join(linkedManifest.packageDir, "package.json");
        const externalManifest = join(linkedManifest.root, "external-package.json");
        renameSync(manifest, externalManifest);
        symlinkSync(externalManifest, manifest, "file");
        expectPrepublishToThrow(linkedManifest);
    });
});
