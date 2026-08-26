import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT_DIR, runAsync, verifyAppStarts, verifyBuiltAppStarts, withRegistry } from "./e2e-registry.js";

const TUTORIAL_DIR = join(ROOT_DIR, "examples", "tutorial");
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
    rmSync(join(TUTORIAL_DIR, "node_modules"), { recursive: true, force: true });
    rmSync(join(TUTORIAL_DIR, "package-lock.json"), { force: true });
    await runAsync("npm", ["install"], { cwd: TUTORIAL_DIR, env });
}

function findArtifact(extension: string): string {
    const outDir = join(TUTORIAL_DIR, "build", "out");
    const found = readdirSync(outDir).find((name) => name.endsWith(extension));

    if (found === undefined) {
        throw new Error(`tutorial: gtkx deploy wrote no ${extension} into ${outDir}`);
    }

    return join(outDir, found);
}

async function extractDeb(env: NodeJS.ProcessEnv, prefix: string): Promise<void> {
    await runAsync("dpkg-deb", ["-x", findArtifact(".deb"), prefix], { cwd: TUTORIAL_DIR, env });
}

function verifyLocalizedStage(): void {
    const stage = join(TUTORIAL_DIR, "build", "stage");
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
        '<p xml:lang="fr">Un gestionnaire de tâches construit avec GTKX, qui montre comment créer ' +
        "des applications de bureau avec React, GTK4 et Adwaita.</p>",
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
    requireFile(join(TUTORIAL_DIR, "build", "targets", "appimage", "AppRun"));
    requireFile(join(TUTORIAL_DIR, "build", "targets", "deb", "nfpm.yaml"));
    requireFile(join(TUTORIAL_DIR, "build", "targets", "rpm", "nfpm.yaml"));
    const flatpak = join(TUTORIAL_DIR, "build", "targets", "flatpak", `${APPLICATION_ID}.yml`);
    requireText(flatpak, "path: ../../stage");
    requireText(flatpak, "cp -a stage/. ${FLATPAK_DEST}/");
}

function verifyRpm(): void {
    const files = execFileSync(resolveExecutable("rpm"), ["-qpl", findArtifact(".rpm")], {
        cwd: TUTORIAL_DIR,
        encoding: "utf8",
    });

    if (!files.split(/\r?\n/).includes(`/usr/${LOCALE_PATH}`)) {
        throw new Error(`tutorial: the rpm does not contain /usr/${LOCALE_PATH}`);
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
    rmSync(join(TUTORIAL_DIR, "build"), { recursive: true, force: true });

    await runAsync("npm", ["run", "deploy", "--", "--print-manifests", "--target", MANIFEST_TARGETS], {
        cwd: TUTORIAL_DIR,
        env,
    });

    verifyLocalizedStage();
    verifyManifests();
    await runAsync("npm", ["run", "deploy", "--", "--target", PACKAGE_TARGETS], { cwd: TUTORIAL_DIR, env });
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

        console.log(`tutorial: the localized ${BINARY_NAME} packages contain their catalog and start`);
    } finally {
        rmSync(prefix, { recursive: true, force: true });
    }
}

async function validateTutorial(env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("npm", ["run", "build"], { cwd: TUTORIAL_DIR, env });
    requireFile(join(TUTORIAL_DIR, "dist", "locale", "fr", "LC_MESSAGES", `${APPLICATION_ID}.mo`));
    await verifyBuiltAppStarts(TUTORIAL_DIR);
    await runAsync("npm", ["run", "typecheck"], { cwd: TUTORIAL_DIR, env });
    await runAsync("npm", ["run", "test"], { cwd: TUTORIAL_DIR, env });
    await deployTutorial(env);
    console.log("tutorial: install, build, run, typecheck, test, and deploy succeeded");
}

async function main(): Promise<void> {
    const passthrough = process.argv.slice(2);

    await withRegistry(async ({ env }) => {
        await installTutorial(env);

        if (passthrough.length > 0) {
            await runAsync("npm", passthrough, { cwd: TUTORIAL_DIR, env });
        } else {
            await validateTutorial(env);
        }
    });
}

await main();
