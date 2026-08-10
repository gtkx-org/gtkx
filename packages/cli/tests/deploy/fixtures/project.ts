import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { DeploySettings } from "../../../src/deploy/types.js";
import { tutorialSettings } from "./settings.js";

type TempProject = {
    root: string;
    settings: DeploySettings;
};

const MANIFEST = {
    name: "gtkx-tutorial",
    version: "1.0.0",
    description: "Tasks app from the GTKX tutorial",
    license: "MPL-2.0",
    author: "GTKX <hello@gtkx.dev>",
    imports: { "#data/*": "./data/*" },
};

const write = (root: string, rel: string, contents: string): void => {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
};

const installTempProject = (): TempProject => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-deploy-project-"));
    write(root, "package.json", JSON.stringify(MANIFEST));
    write(root, "LICENSE", "Mozilla Public License Version 2.0\n\nfine print\n");
    write(root, "dist/bundle.js", "console.log('app');\n");
    write(root, "dist/gtkx.node", "ELF stub");
    write(root, "dist/gtkx.gresource", "gresource stub");
    write(root, "dist/gschemas.compiled", "compiled stub");
    write(root, "dist/assets/style.css", "body {}\n");
    write(root, "dist/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg", "<svg/>");
    write(root, "data/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg", "<svg/>");
    write(root, "data/com.gtkx.tutorial.gschema.xml", "<schemalist/>");
    const settings = tutorialSettings();

    settings.paths = {
        ...settings.paths,
        root,
        dist: join(root, "dist"),
        outDir: join(root, "build/deploy"),
        metadata: join(root, "build/deploy/metadata"),
        runtime: join(root, "build/deploy/runtime"),
        stage: join(root, "build/deploy/stage"),
        overlay: join(root, "build/deploy/overlay"),
        targets: join(root, "build/deploy/targets"),
        output: join(root, "build/deploy/out"),
        iconsDir: join(root, "data/icons"),
        licenseFile: join(root, "LICENSE"),
        schemaFiles: [join(root, "data/com.gtkx.tutorial.gschema.xml")],
    };

    return { root, settings };
};

const removeTempProject = (project: TempProject): void => {
    rmSync(project.root, { recursive: true, force: true });
};

export { installTempProject, removeTempProject, type TempProject };
