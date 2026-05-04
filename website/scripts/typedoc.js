import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const website = resolve(root, "website");
const apiDir = resolve(website, "api");

const packages = [
    {
        name: "react",
        entryPoints: [resolve(root, "packages/react/src/index.ts")],
        tsconfig: resolve(root, "packages/react/tsconfig.lib.json"),
        excludeInternal: true,
        intentionallyNotExported: [
            "ReconcilerInstance",
            "AnimationBaseProps",
            "BaseListViewProps",
            "GtkColumnViewBase",
            "Container",
            "SettingTypeMap",
        ],
    },
    {
        name: "css",
        entryPoints: [resolve(root, "packages/css/src/index.ts")],
        tsconfig: resolve(root, "packages/css/tsconfig.lib.json"),
        excludeInternal: true,
        intentionallyNotExported: ["CSSClassName"],
    },
    {
        name: "testing",
        entryPoints: [resolve(root, "packages/testing/src/index.ts")],
        tsconfig: resolve(root, "packages/testing/tsconfig.lib.json"),
        excludeInternal: true,
        intentionallyNotExported: ["ElementOrCallback"],
    },
    {
        name: "ffi",
        entryPoints: [resolve(root, "packages/ffi/src/index.ts")],
        tsconfig: resolve(root, "packages/ffi/tsconfig.lib.json"),
        excludeInternal: true,
        intentionallyNotExported: ["GError", "NativeEventMap", "GetNativeObjectResult"],
    },
];

rmSync(apiDir, { recursive: true, force: true });

for (const pkg of packages) {
    const args = [
        "typedoc",
        ...pkg.entryPoints.flatMap((e) => ["--entryPoints", e]),
        "--tsconfig",
        pkg.tsconfig,
        "--out",
        resolve(apiDir, pkg.name),
        "--plugin",
        "typedoc-plugin-markdown",
        "--plugin",
        "typedoc-vitepress-theme",
        "--readme",
        "none",
        "--indexFormat",
        "table",
        "--parametersFormat",
        "table",
        "--enumMembersFormat",
        "table",
        "--typeDeclarationFormat",
        "table",
        "--groupOrder",
        "Functions,Variables,Interfaces,*",
        ...(pkg.excludeInternal ? ["--excludeInternal"] : []),
        ...(pkg.intentionallyNotExported
            ? pkg.intentionallyNotExported.flatMap((name) => ["--intentionallyNotExported", name])
            : []),
    ];

    console.log(`Generating API docs for @gtkx/${pkg.name}...`);
    execFileSync("npx", args, { cwd: root, stdio: "inherit" });
}

function escapeJsxTags(dir) {
    for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        if (statSync(fullPath).isDirectory()) {
            escapeJsxTags(fullPath);
            continue;
        }
        if (!entry.endsWith(".md")) continue;

        let content = readFileSync(fullPath, "utf-8");
        content = content.replace(/<(\/?)(Gtk|Adw|Gdk|Gio|GLib|GObject|Pango|x\.)/g, "&lt;$1$2");
        content = content.replace(/\{\{/g, "&#123;&#123;");
        content = content.replace(/\}\}/g, "&#125;&#125;");
        writeFileSync(fullPath, content);
    }
}

escapeJsxTags(apiDir);
console.log("API docs generated.");
