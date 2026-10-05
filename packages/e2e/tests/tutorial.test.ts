import { resolveExecutable, tryResolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { ROOT_DIR, runAsync, verifyAppStarts, verifyBuiltAppStarts } from "./helpers/registry.js";
import { verifyInstalledActions } from "./helpers/tutorial-activation.js";
import { createCheckpoint } from "./helpers/tutorial-checkpoints.js";

let tutorialRoot = "";
let tutorialDir = "";
const APPLICATION_ID = "com.gtkx.tutorial";
const BINARY_NAME = "gtkx-tutorial";
const MANIFEST_TARGETS = "appimage,deb,flatpak,rpm";
const PACKAGE_TARGETS = "appimage,deb,rpm";
const LOCALE_PATH = join("share", "locale", "fr", "LC_MESSAGES", `${APPLICATION_ID}.mo`);
const FRENCH_ENV = { LANG: "fr_FR.UTF-8", LANGUAGE: "fr", LC_ALL: "fr_FR.UTF-8" };

function requireFile(path: string): void {
    if (!existsSync(path)) {
        throw new Error(`tutorial: expected ${path}`);
    }
}

function requireText(path: string, expected: string): void {
    const contents = readFileSync(path, "utf8");

    if (!contents.includes(expected)) {
        throw new Error(`tutorial: ${path} does not contain ${JSON.stringify(expected)}`);
    }
}

async function installTutorial(env: NodeJS.ProcessEnv): Promise<void> {
    rmSync(join(tutorialDir, "node_modules"), { recursive: true, force: true });
    rmSync(join(tutorialDir, "package-lock.json"), { force: true });
    await runAsync("npm", ["install"], { cwd: tutorialDir, env });
}

function findArtifact(extension: string): string {
    const outDir = join(tutorialDir, "build", "out");
    const found = readdirSync(outDir).find((name) => name.endsWith(extension));

    if (found === undefined) {
        throw new Error(`tutorial: gtkx deploy wrote no ${extension} into ${outDir}`);
    }

    return join(outDir, found);
}

async function extractDeb(env: NodeJS.ProcessEnv, prefix: string): Promise<void> {
    const artifact = findArtifact(".deb");
    const dpkgDeb = tryResolveExecutable("dpkg-deb");

    if (dpkgDeb !== undefined) {
        await runAsync(dpkgDeb, ["-x", artifact, prefix], { cwd: tutorialDir, env });

        return;
    }

    const extraction = mkdtempSync(join(tmpdir(), "gtkx-tutorial-deb-"));

    try {
        await runAsync(resolveExecutable("ar"), ["x", artifact], { cwd: extraction, env });
        const payload = readdirSync(extraction).find((name) => /^data\.tar(?:\..+)?$/u.test(name));

        if (payload === undefined) {
            throw new Error(`tutorial: ${artifact} contains no data archive`);
        }

        await runAsync(resolveExecutable("tar"), ["-xf", join(extraction, payload), "-C", prefix], {
            cwd: tutorialDir,
            env,
        });
    } finally {
        rmSync(extraction, { recursive: true, force: true });
    }
}

function verifyLocalizedStage(): void {
    const stage = join(tutorialDir, "build", process.arch, "stage");
    const desktop = join(stage, "share", "applications", `${APPLICATION_ID}.desktop`);
    const metainfo = join(stage, "share", "metainfo", `${APPLICATION_ID}.metainfo.xml`);
    requireFile(join(stage, LOCALE_PATH));

    for (const expected of [
        "Name[fr]=Tâches",
        "GenericName[fr]=Gestionnaire de tâches",
        "Comment[fr]=Gérez vos tâches et listes de choses à faire",
        "Keywords[fr]=Tâche;Tâches;À faire;À-faire;Liste de contrôle;",
    ]) {
        requireText(desktop, expected);
    }

    for (const expected of [
        '<name xml:lang="fr">Tâches</name>',
        '<summary xml:lang="fr">Gérez vos tâches et listes de choses à faire</summary>',
        '<p xml:lang="fr">Un gestionnaire de tâches GNOME construit avec GTKX, qui montre comment créer ' +
        "des applications Adwaita avec React.</p>",
        '<keyword xml:lang="fr">Tâche</keyword>',
        '<caption xml:lang="fr">Parcours des listes de tâches dans la barre latérale</caption>',
        '<caption xml:lang="fr">Modification d’une tâche</caption>',
        '<p xml:lang="fr">Version initiale.</p>',
    ]) {
        requireText(metainfo, expected);
    }

    requireText(join(stage, "bin", BINARY_NAME), 'GTKX_LOCALE_DIR="$prefix/share/locale"');
}

function verifyManifests(): void {
    requireFile(join(tutorialDir, "build", process.arch, "targets", "appimage", "AppRun"));
    requireFile(join(tutorialDir, "build", process.arch, "targets", "deb", "nfpm.yaml"));
    requireFile(join(tutorialDir, "build", process.arch, "targets", "rpm", "nfpm.yaml"));
    const flatpak = join(tutorialDir, "build", process.arch, "targets", "flatpak", `${APPLICATION_ID}.yml`);
    requireText(flatpak, "path: ../../stage");
    requireText(flatpak, "cp -a stage/. ${FLATPAK_DEST}/");
}

function verifyRpm(): void {
    const database = mkdtempSync(join(tmpdir(), "gtkx-tutorial-rpm-"));

    try {
        const files = execFileSync(resolveExecutable("rpm"), ["--dbpath", database, "-qpl", findArtifact(".rpm")], {
            cwd: tutorialDir,
            encoding: "utf8",
        });

        if (!files.split(/\r?\n/).includes(`/usr/${LOCALE_PATH}`)) {
            throw new Error(`tutorial: the rpm does not contain /usr/${LOCALE_PATH}`);
        }
    } finally {
        rmSync(database, { recursive: true, force: true });
    }
}

async function verifyAppImage(env: NodeJS.ProcessEnv): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), "gtkx-tutorial-appimage-"));

    try {
        await runAsync(findArtifact(".AppImage"), ["--appimage-extract", join("usr", LOCALE_PATH)], {
            cwd: directory,
            env,
        });

        requireFile(join(directory, "squashfs-root", "usr", LOCALE_PATH));
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

async function deployTutorial(env: NodeJS.ProcessEnv): Promise<void> {
    rmSync(join(tutorialDir, "build"), { recursive: true, force: true });

    await runAsync("npm", ["run", "deploy", "--", "--print-manifests", "--target", MANIFEST_TARGETS], {
        cwd: tutorialDir,
        env,
    });

    verifyLocalizedStage();
    verifyManifests();
    await runAsync("npm", ["run", "deploy", "--", "--target", PACKAGE_TARGETS], { cwd: tutorialDir, env });
    verifyLocalizedStage();
    verifyRpm();
    await verifyAppImage(env);
    const prefix = mkdtempSync(join(tmpdir(), "gtkx-tutorial-install-"));

    try {
        await extractDeb(env, prefix);
        requireFile(join(prefix, "usr", LOCALE_PATH));

        requireText(
            join(prefix, "usr", "share", "applications", `${APPLICATION_ID}.desktop`),
            "Name[fr]=Tâches",
        );

        await verifyAppStarts(prefix, {
            command: join(prefix, "usr", "bin", BINARY_NAME),
            args: [],
            env: FRENCH_ENV,
        });

        await verifyInstalledActions(prefix, APPLICATION_ID, BINARY_NAME);

        console.log(`tutorial: the localized ${BINARY_NAME} packages contain their catalog and start`);
    } finally {
        rmSync(prefix, { recursive: true, force: true });
    }
}

async function validateTutorial(env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("npm", ["run", "typecheck"], { cwd: tutorialDir, env });
    await runAsync("eslint", ["--config", join(ROOT_DIR, "eslint.config.ts"), "."], { cwd: tutorialDir, env });
    await runAsync("npm", ["run", "build"], { cwd: tutorialDir, env });
    requireFile(join(tutorialDir, "dist", "locale", "fr", "LC_MESSAGES", `${APPLICATION_ID}.mo`));
    await verifyBuiltAppStarts(tutorialDir);
    await runAsync("npm", ["run", "test"], { cwd: tutorialDir, env });
    await deployTutorial(env);
    console.log("tutorial: install, lint, build, run, typecheck, test, and deploy succeeded");
}

describe("tutorial as a published consumer", () => {
    beforeAll(async () => {
        tutorialRoot = mkdtempSync(join(tmpdir(), "gtkx-tutorial-"));
        tutorialDir = join(tutorialRoot, "app");
        cpSync(join(ROOT_DIR, "tutorial"), tutorialDir, {
            recursive: true,
            filter: (source) => !["node_modules", "dist", "build", ".gtkx"].some((name) =>
                source === join(ROOT_DIR, "tutorial", name)),
        });
        await installTutorial(inject("registry").env);
    });

    afterAll(() => {
        rmSync(tutorialRoot, { recursive: true, force: true });
    });

    it("builds, launches, tests, and packages the localized tutorial application", async () => {
        await expect(validateTutorial(inject("registry").env)).resolves.toBeUndefined();
    });

    it("builds and launches every documented tutorial checkpoint", async () => {
        await expect(createCheckpoint({
            version: "v2",
            chapter: "flatpak",
            check: true,
            dependencies: join(tutorialDir, "node_modules"),
            env: inject("registry").env,
        })).resolves.toBeUndefined();
    });
});
