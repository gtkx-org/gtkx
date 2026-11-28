import { execFile } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { createProject } from "./project.js";
import { invoke } from "./invoke.js";

describe("gtkx deploy", () => {
    it("suggests a deploy section derived from package.json, linking the Deploying guide", async () => {
        using project = createProject();
        await expect(invoke(["deploy", "--cwd", project.root])).rejects.toThrow(
            /no `deploy` section.*name: "cli-example".*license: "MIT".*see https:\/\/gtkx\.dev\/v2\/guide\/deploying\.$/s,
        );
    });

    it("writes deployment manifests and stages a real built application", async () => {
        using project = createProject({
            deploy: {
                name: "CLI Example",
                summary: "Exercises the deployment command",
                categories: ["Utility"],
                description: ["An example application used to exercise real deployment output."],
                developer: { name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                homepage: "https://gtkx.dev",
                node: { source: "path", path: "tools/node", shouldStrip: false },
                extraFiles: {
                    "share/man/man1/cli-example.1": "packaging/cli-example.1",
                    "share/bash-completion/completions/cli-example": "packaging/cli-example.bash",
                    "share/cli-example/presets/default.json": "packaging/default.json",
                    "lib/cli-example-report": "dist-report",
                },
            },
        });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
        project.write("packaging/cli-example.1", ".TH CLI-EXAMPLE 1\n");
        project.write("packaging/cli-example.bash", "complete -W --help cli-example\n");
        project.write("packaging/default.json", "{}\n");
        project.write("dist-report/bundle.mjs", 'import "./assets/glib-CzVA7iGT.mjs";\n');
        project.write("dist-report/assets/glib-CzVA7iGT.mjs", "export {};\n");
        project.write("dist-report/gtkx.node", "native\n");
        chmodSync(join(project.root, "dist-report/gtkx.node"), 0o755);
        const nodeLicense = "Node.js is licensed for use as follows: vendored runtime license";
        project.write("vendor/node/LICENSE", nodeLicense);
        mkdirSync(join(project.root, "vendor/node/bin"));
        copyFileSync(process.execPath, join(project.root, "vendor/node/bin/node"));
        mkdirSync(join(project.root, "tools"));
        symlinkSync("../vendor/node/bin/node", join(project.root, "tools/node"));
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        const config = readFileSync(join(project.root, "gtkx.config.ts"), "utf8");
        project.write(
            "gtkx.config.ts",
            config.replace('"codegen":false', '"codegen":false,"applicationIcon":"icon.svg"'),
        );
        project.write(
            "data/org.gtkx.example.gschema.xml",
            `<?xml version="1.0" encoding="UTF-8"?>
            <schemalist>
                <schema id="org.gtkx.example" path="/org/gtkx/example/">
                    <key name="font" type="s"><default>'Monospace 12'</default></key>
                </schema>
            </schemalist>`,
        );
        project.write("src/index.ts", 'export { default } from "../data/org.gtkx.example.gschema.xml";');
        await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "appimage,deb,flatpak,rpm"]);
        const build = join(project.root, "build", process.arch);
        const contents = (packager: string) =>
            (
                parse(readFileSync(join(build, "targets", packager, "nfpm.yaml"), "utf8")) as {
                    contents: { dst: string; type?: string; file_info?: { mode: number } }[];
                }
            ).contents;
        const packaged = (packager: string) => contents(packager).map((content) => content.dst);
        for (const packager of ["deb", "rpm"]) {
            expect(packaged(packager)).toContain("/usr/share/glib-2.0/schemas/org.gtkx.example.gschema.xml");
            expect(packaged(packager).filter((path) => path.endsWith("gschemas.compiled"))).toEqual([]);
        }
        expect(
            contents("rpm")
                .filter((content) => content.type === "dir" && content.dst.startsWith("/usr/share"))
                .map((content) => content.dst),
        ).toEqual(["/usr/share/cli-example", "/usr/share/cli-example/presets", "/usr/share/licenses/cli-example"]);
        const helper = (packager: string) =>
            Object.fromEntries(
                contents(packager)
                    .filter((content) => content.dst.startsWith("/usr/lib/cli-example-report"))
                    .map((content) => [content.dst, content.type ?? content.file_info?.mode]),
            );
        const helperFiles = {
            "/usr/lib/cli-example-report/assets/glib-CzVA7iGT.mjs": 0o644,
            "/usr/lib/cli-example-report/bundle.mjs": 0o644,
            "/usr/lib/cli-example-report/gtkx.node": 0o755,
        };
        expect(helper("deb")).toEqual(helperFiles);
        expect(helper("rpm")).toEqual({
            ...helperFiles,
            "/usr/lib/cli-example-report": "dir",
            "/usr/lib/cli-example-report/assets": "dir",
        });
        expect(contents("rpm").map((content) => content.dst)).not.toContain("/usr/lib");
        expect(readFileSync(join(build, "stage/lib/cli-example-report/assets/glib-CzVA7iGT.mjs"), "utf8")).toBe(
            "export {};\n",
        );
        const flatpak = parse(readFileSync(join(build, "targets/flatpak/org.gtkx.example.yml"), "utf8")) as {
            modules: { "post-install": string[] }[];
        };
        expect(flatpak.modules.at(-1)?.["post-install"]).toEqual([
            "glib-compile-schemas ${FLATPAK_DEST}/share/glib-2.0/schemas",
        ]);
        expect(readFileSync(join(build, "stage/share/metainfo/org.gtkx.example.metainfo.xml"), "utf8")).not.toContain(
            "<translation",
        );
        for (const schemaFile of ["gschemas.compiled", "org.gtkx.example.gschema.xml"]) {
            expect(existsSync(join(build, "stage/lib/cli-example", schemaFile))).toBe(false);
            expect(existsSync(join(build, "overlay/appimage/lib/cli-example", schemaFile))).toBe(true);
        }
        const files = readdirSync(join(project.root, "build"), { recursive: true }).map(String);
        expect(files).toEqual(
            expect.arrayContaining([
                expect.stringContaining("targets/deb/nfpm.yaml"),
                expect.stringContaining("targets/rpm/nfpm.yaml"),
                expect.stringContaining("targets/flatpak/org.gtkx.example.yml"),
            ]),
        );
        expect(files.some((file) => file.endsWith("bundle.mjs"))).toBe(true);
        expect(
            readFileSync(join(project.root, "build", process.arch, "targets/flatpak/org.gtkx.example.yml"), "utf8"),
        ).toContain("separate-locales: false");
        const notices = readFileSync(
            join(project.root, "build", process.arch, "overlay/rpm/share/licenses/cli-example/THIRD-PARTY-NOTICES"),
            "utf8",
        );
        expect(notices).toContain(nodeLicense);
    });

    it("refuses to package with --skip-build a dist/ built from another entry", async () => {
        using project = createProject({
            applicationIcon: "icon.svg",
            deploy: {
                name: "CLI Example",
                summary: "Exercises the deployment command",
                categories: ["Utility"],
                description: ["An example application used to exercise real deployment output."],
                developer: { name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                node: { source: "host", shouldStrip: false },
            },
        });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
        project.write("icon.svg", '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>');
        project.write("src/report.ts", 'console.log("report");');
        const deploy = ["deploy", "--cwd", project.root, "--skip-build", "--print-manifests", "--target", "deb"];
        await invoke(["build", "--cwd", project.root, "src/report.ts"]);
        await expect(invoke(deploy)).rejects.toThrow(
            "dist/gtkx-schemas.json was built from src/report.ts, not the application entry src/index.ts",
        );
        await invoke(["build", "--cwd", project.root]);
        await invoke(deploy);
    });

    it("requires the shared libraries of configured GIR libraries in system packages", async () => {
        const deploy = {
            name: "CLI Example",
            summary: "Exercises the deployment command",
            categories: ["Utility"],
            description: ["An example application used to exercise real deployment output."],
            developer: { name: "GTKX", email: "hello@gtkx.dev" },
            license: "MIT",
        };
        const config = { codegen: true, applicationIcon: "icon.svg", libraries: ["GtkSource-5"] };
        using project = createProject({ ...config, deploy });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        const depends = (packager: string) =>
            (
                parse(
                    readFileSync(join(project.root, "build", process.arch, "targets", packager, "nfpm.yaml"), "utf8"),
                ) as {
                    depends: string[];
                }
            ).depends;
        const output = await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "deb,rpm"]);
        expect(depends("rpm")).toEqual(
            expect.arrayContaining([
                "libgtk-4.so.1()(64bit)",
                "libadwaita-1.so.0()(64bit)",
                "libgtksourceview-5.so.0()(64bit)",
            ]),
        );
        expect(output).toContain("GtkSource-5 (libgtksourceview-5.so.0)");
        expect(output).toContain("`deploy.depends.deb`");
        project.write(
            "gtkx.config.ts",
            `export default ${JSON.stringify({
                applicationId: "org.gtkx.example",
                agents: { reference: false, rules: false },
                ...config,
                deploy: { ...deploy, depends: { deb: ["libgtksourceview-5-0"] } },
            })};`,
        );
        const covered = await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "deb"]);
        expect(depends("deb")).toContain("libgtksourceview-5-0");
        expect(covered).not.toContain("`deploy.depends.deb`");
    });

    it("renders a source Flatpak that installs with pnpm 12's native binary and keeps workers and translations", async () => {
        using project = createProject({
            applicationIcon: "icon.svg",
            deploy: {
                name: "CLI Example",
                summary: "Exercises the source Flatpak manifest",
                categories: ["Utility"],
                keywords: ["example", "manifest"],
                description: ["An example application used to exercise a Flathub source manifest."],
                developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                homepage: "https://gtkx.dev",
                releases: [{ version: "1.0.0", date: "2026-10-30" }],
                contentRating: {},
                flatpak: {
                    mode: "source",
                    source: { url: "https://example.org/cli-example.git", commit: "0".repeat(40) },
                },
            },
        });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
        project.write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n\nimporters:\n\n  .: {}\n");
        project.write("po/LINGUAS", "fr\n");
        project.write("po/fr.po", readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8"));
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "flatpak"]);
        expect(readdirSync(join(project.root, "po")).toSorted()).toEqual([
            "LINGUAS",
            "POTFILES.in",
            "fr.po",
            "org.gtkx.example.pot",
        ]);
        expect(readFileSync(join(project.root, "po/org.gtkx.example.pot"), "utf8")).toMatch(
            /^#\. Translators: .* Do NOT translate or localize the semicolons! .*\n#: .*\nmsgid "example;manifest;"$/m,
        );
        const manifest = parse(
            readFileSync(join(project.root, "build", process.arch, "targets/flatpak/org.gtkx.example.yml"), "utf8"),
        ) as { modules: { sources: Record<string, unknown>[]; "build-commands": string[] }[] };
        const module = manifest.modules.at(-1);
        const nativeBinaries = module?.sources
            .filter((source) => String(source.url).includes("/@pnpm/exe."))
            .map((source) => ({
                type: source.type,
                url: source.url,
                hasDigest: /^[\da-f]{128}$/.test(String(source.sha512)),
                onlyArches: source["only-arches"],
            }));
        expect(nativeBinaries).toEqual([
            {
                type: "archive",
                url: "https://registry.npmjs.org/@pnpm/exe.linux-arm64/-/exe.linux-arm64-12.23.0.tgz",
                hasDigest: true,
                onlyArches: ["aarch64"],
            },
            {
                type: "archive",
                url: "https://registry.npmjs.org/@pnpm/exe.linux-x64/-/exe.linux-x64-12.23.0.tgz",
                hasDigest: true,
                onlyArches: ["x86_64"],
            },
        ]);
        expect(module?.["build-commands"].some((command) => command.startsWith("test ! -d dist/workers ||"))).toBe(
            true,
        );
        expect(JSON.stringify(module)).not.toContain("pnpm.cjs");
        expect(JSON.stringify(module)).not.toContain("gschemas.compiled");
        const metainfo = module?.sources.find((source) => source["dest-filename"] === "org.gtkx.example.metainfo.xml");
        expect(String(metainfo?.contents)).toContain('<translation type="gettext">org.gtkx.example</translation>');
        const localeConfig = module?.sources.find((source) => source["dest-filename"] === "gtkx-i18n.json");
        expect(JSON.parse(String(localeConfig?.contents))).toEqual({ localeDir: "../../share/locale" });
        expect(
            module?.["build-commands"].some((command) =>
                command.endsWith("gtkx-i18n.json ${FLATPAK_DEST}/lib/cli-example/gtkx-i18n.json"),
            ),
        ).toBe(true);
    });

    it("stops a source Flatpak whose pinned commit lacks the lockfile it installs from", async () => {
        using project = createProject({
            applicationIcon: "icon.svg",
            deploy: {
                name: "CLI Example",
                summary: "Exercises the source Flatpak manifest",
                categories: ["Utility"],
                description: ["An example application used to exercise a Flathub source manifest."],
                developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                homepage: "https://gtkx.dev",
                releases: [{ version: "1.0.0", date: "2026-11-05" }],
                contentRating: {},
                flatpak: { mode: "source", source: { url: "https://example.org/cli-example.git" } },
            },
        });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
        project.write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n\nimporters:\n\n  .: {}\n");
        project.write(".gitignore", "node_modules/\nbuild/\ndist/\npnpm-lock.yaml\n");
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        const git = (...args: string[]) =>
            promisify(execFile)(
                "git",
                ["-c", "user.name=GTKX", "-c", "user.email=hello@gtkx.dev", "-c", "commit.gpgSign=false", ...args],
                { cwd: project.root },
            );
        await git("init", "--quiet");
        await git("add", "--all");
        await git("commit", "--quiet", "--message", "Release without the lockfile");
        const preview = () => invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "flatpak"]);
        await expect(preview()).rejects.toThrow();
        await git("add", "--force", "pnpm-lock.yaml");
        await git("commit", "--quiet", "--message", "Commit the lockfile");
        await preview();
        expect(existsSync(join(project.root, "build", process.arch, "targets/flatpak/generated-sources.json"))).toBe(
            true,
        );
    });

    it("renders a source Flatpak that installs a Yarn 4 project with its pinned Yarn release", async () => {
        const digest =
            "b2e1e7524f654f2749d32b4ebcb4622473cb5bcbc485df2007e12a154e50162a4d795526768bc5f5b8f81717bfd79deb" +
            "2472813d86fb5ae2eb551fa9c872b08f";
        using project = createProject({
            applicationIcon: "icon.svg",
            deploy: {
                name: "CLI Example",
                summary: "Exercises the source Flatpak manifest",
                categories: ["Utility"],
                description: ["An example application used to exercise a Flathub source manifest."],
                developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                homepage: "https://gtkx.dev",
                releases: [{ version: "1.0.0", date: "2026-11-04" }],
                contentRating: {},
                flatpak: {
                    mode: "source",
                    source: { url: "https://example.org/cli-example.git", commit: "0".repeat(40) },
                },
            },
        });
        project.write(
            "package.json",
            JSON.stringify({
                name: "cli-example",
                version: "1.0.0",
                type: "module",
                license: "MIT",
                packageManager: `yarn@4.18.1+sha512.${digest}`,
                dependencies: {},
            }),
        );
        project.write(
            "yarn.lock",
            '__metadata:\n  version: 10\n  cacheKey: 10c0\n\n"cli-example@workspace:.":\n  version: 0.0.0-use.local\n' +
                '  resolution: "cli-example@workspace:."\n  languageName: unknown\n  linkType: soft\n',
        );
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "flatpak"]);
        const manifest = parse(
            readFileSync(join(project.root, "build", process.arch, "targets/flatpak/org.gtkx.example.yml"), "utf8"),
        ) as {
            modules: {
                "build-options": { "append-path": string; env: Record<string, string> };
                sources: Record<string, unknown>[];
                "build-commands": string[];
            }[];
        };
        const module = manifest.modules.at(-1);
        expect(module?.sources).toContainEqual({
            type: "file",
            url: "https://repo.yarnpkg.com/4.18.1/packages/yarnpkg-cli/bin/yarn.js",
            sha512: digest,
            dest: "flatpak-yarn",
            "dest-filename": "yarn.cjs",
        });
        expect(module?.sources).toContainEqual({
            type: "script",
            dest: "flatpak-yarn",
            "dest-filename": "yarn",
            commands: ['exec node /run/build/cli-example/flatpak-yarn/yarn.cjs "$@"'],
        });
        expect(module?.["build-options"]["append-path"]).toBe(
            "/run/build/cli-example/flatpak-yarn:/usr/lib/sdk/node26/bin",
        );
        expect(module?.["build-options"].env).toEqual({
            npm_config_nodedir: "/usr/lib/sdk/node26",
            YARN_ENABLE_NETWORK: "0",
            YARN_ENABLE_GLOBAL_CACHE: "0",
            YARN_GLOBAL_FOLDER: "/run/build/cli-example/flatpak-node/yarn-berry",
        });
        expect(module?.["build-commands"].slice(0, 3)).toEqual([
            "yarn plugin import /run/build/cli-example/flatpak-node/flatpak-yarn.js",
            "yarn convertToZip /usr/lib/sdk/node26/bin/yarn",
            "yarn install --immutable",
        ]);
    });

    it("asks a Yarn 4 project to pin Yarn before vendoring its dependencies", async () => {
        using project = createProject({
            applicationIcon: "icon.svg",
            deploy: {
                name: "CLI Example",
                summary: "Exercises the source Flatpak manifest",
                categories: ["Utility"],
                description: ["An example application used to exercise a Flathub source manifest."],
                developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                homepage: "https://gtkx.dev",
                releases: [{ version: "1.0.0", date: "2026-11-06" }],
                contentRating: {},
                flatpak: {
                    mode: "source",
                    source: { url: "https://example.org/cli-example.git", commit: "0".repeat(40) },
                },
            },
        });
        project.write(
            "yarn.lock",
            '__metadata:\n  version: 10\n  cacheKey: 10c0\n\n"cli-example@workspace:.":\n  version: 0.0.0-use.local\n' +
                '  resolution: "cli-example@workspace:."\n  dependencies:\n    gtkx-unpublished-package: "npm:^1.0.0"\n' +
                '  languageName: unknown\n  linkType: soft\n\n"gtkx-unpublished-package@npm:^1.0.0":\n' +
                '  version: 1.0.0\n  resolution: "gtkx-unpublished-package@npm:1.0.0"\n' +
                `  checksum: 10c0/${"0".repeat(128)}\n  languageName: node\n  linkType: hard\n`,
        );
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        const deploy = invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "flatpak"]);
        await expect(deploy).rejects.toThrow('package.json has no "packageManager" field');
        await expect(deploy).rejects.toThrow("corepack use yarn@<version>");
    });

    it("stops a source Flatpak of a workspace member and points to a standalone project", async () => {
        using project = createProject();
        project.write(
            "package.json",
            JSON.stringify({ name: "studio", private: true, type: "module", workspaces: ["apps/*"] }),
        );
        project.write("yarn.lock", "__metadata:\n  version: 10\n  cacheKey: 10c0\n");
        project.write(
            "apps/swatches/package.json",
            JSON.stringify({ name: "swatches", version: "1.0.0", type: "module", license: "MIT", dependencies: {} }),
        );
        project.write(
            "apps/swatches/gtkx.config.ts",
            `export default ${JSON.stringify({
                applicationId: "org.gtkx.swatches",
                codegen: false,
                agents: { reference: false, rules: false },
                deploy: {
                    name: "Swatches",
                    summary: "Exercises a workspace member's source Flatpak",
                    categories: ["Utility"],
                    description: ["An example application inside a workspace."],
                    developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
                    license: "MIT",
                    homepage: "https://gtkx.dev",
                    flatpak: {
                        mode: "source",
                        source: { url: "https://example.org/studio.git", commit: "0".repeat(40) },
                    },
                },
            })};`,
        );
        project.write("apps/swatches/src/index.ts", 'export const greeting = "hello from a member";');
        const app = join(project.root, "apps/swatches");
        const deploy = invoke(["deploy", "--cwd", app, "--print-manifests", "--target", "flatpak"]);
        await expect(deploy).rejects.toThrow(`member of the workspace at ${project.root}`);
        await expect(deploy).rejects.toThrow("standalone project");
        expect(existsSync(join(app, "build"))).toBe(false);
    });

    it("reports actionable deployment configuration errors", async () => {
        using project = createProject();
        await expect(invoke(["deploy", "--cwd", project.root, "--print-manifests"])).rejects.toThrow("deploy");
    });
});
