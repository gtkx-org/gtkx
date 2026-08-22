import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    PACKAGES_DIR,
    REGISTRY,
    type RegistryContext,
    runAsync,
    verifyBuiltAppStarts,
    withRegistry,
} from "./e2e-registry.js";
import { assertPublishedShape, type PackageManifest } from "./publish-manifest.js";

type ConsumerVariant = { appName: string; applicationId: string; isTypescript: boolean };

type Packument = {
    "dist-tags": { latest?: string };
    versions: Record<string, { dist: { tarball: string } }>;
};

const CONSUMER_VARIANTS: ConsumerVariant[] = [
    { appName: "release-e2e-ts", applicationId: "com.gtkx.release-e2e-ts", isTypescript: true },
    { appName: "release-e2e-js", applicationId: "com.gtkx.release-e2e-js", isTypescript: false },
];

const SCAFFOLDED_LIBRARIES = "libraries: [\"Gtk-4.0\"],";

/* eslint-disable unicorn/no-incorrect-template-string-interpolation -- the braces below are JSX, not interpolation */
const CONSUMER_APP_SOURCE = `import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { AdwActionRow, AdwAvatar, AdwBanner, AdwPreferencesGroup, AdwSwitchRow } from "@gtkx/jsx/adw";
import { GMenu, GSimpleAction } from "@gtkx/jsx/gio";
import {
    GtkApplication,
    GtkApplicationWindow,
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkDropDown,
    GtkEntry,
    GtkFrame,
    GtkHeaderBar,
    GtkLabel,
    GtkLevelBar,
    GtkListView,
    GtkMenuButton,
    GtkProgressBar,
    GtkScrolledWindow,
    GtkSearchEntry,
    GtkSeparator,
    GtkSignalListItemFactory,
    GtkSingleSelection,
    GtkStack,
    GtkStackPage,
    GtkStringList,
    GtkSwitch,
    GtkTextView,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";
import { useState } from "react";

const ITEMS = ["Alpha", "Beta", "Gamma"];
const UNRESOLVED = "The published packages resolved an unexpected wrapper class for ";

const Titlebar = () => (
    <GtkHeaderBar
        start={<GtkToggleButton iconName="view-list-symbolic" tooltipText="Toggle the sidebar" />}
        end={(
            <GtkMenuButton
                iconName="open-menu-symbolic"
                menuModel={<GMenu items={[{ section: [{ label: "_Reset", action: "win.reset" }] }]} />}
                ref={(button) => {
                    if (button !== null && !(button.getMenuModel() instanceof Gio.Menu)) {
                        throw new TypeError(UNRESOLVED + "Gio.Menu");
                    }
                }}
            />
        )}
    />
);

const Counter = () => {
    const [count, setCount] = useState(0);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={12}
            ref={(box) => {
                if (box !== null && !(box.getFirstChild() instanceof Gtk.Label)) {
                    throw new TypeError(UNRESOLVED + "Gtk.Label");
                }
            }}
        >
            <GtkLabel cssClasses={["title-1"]}>Welcome to GTKX!</GtkLabel>
            <GtkLabel
                cssClasses={["title-2"]}
                ellipsize={Pango.EllipsizeMode.END}
                ref={(label) => {
                    if (label !== null && !(label.getLayout() instanceof Pango.Layout)) {
                        throw new TypeError(UNRESOLVED + "Pango.Layout");
                    }
                }}
            >
                Count: {count}
            </GtkLabel>
            <GtkButton
                label="Increment"
                onClicked={() => setCount((c) => c + 1)}
                cssClasses={["suggested-action", "pill"]}
            />
        </GtkBox>
    );
};

const Gauges = () => (
    <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
        <GtkCheckButton label="Ready" active />
        <GtkSwitch active />
        <GtkSeparator orientation={Gtk.Orientation.VERTICAL} />
        <GtkLevelBar value={0.4} />
        <GtkProgressBar fraction={0.7} showText text="Loading" />
        <AdwAvatar size={24} text="GTKX" showInitials />
    </GtkBox>
);

const Details = () => (
    <AdwPreferencesGroup title="Details" description="Rows rendered by libadwaita">
        <AdwActionRow title="Namespaces" subtitle="Adw, Gdk, Gio, Gtk, and Pango" />
        <AdwSwitchRow title="Notifications" active />
    </AdwPreferencesGroup>
);

const Items = () => (
    <GtkScrolledWindow
        vexpand
        minContentHeight={120}
        ref={(scrolled) => {
            if (scrolled === null) {
                return;
            }

            if (!(scrolled.getVadjustment() instanceof Gtk.Adjustment)) {
                throw new TypeError(UNRESOLVED + "Gtk.Adjustment");
            }

            if (!(scrolled.getVscrollbar() instanceof Gtk.Scrollbar)) {
                throw new TypeError(UNRESOLVED + "Gtk.Scrollbar");
            }
        }}
    >
        <GtkListView
            model={<GtkSingleSelection model={<GtkStringList strings={ITEMS} />} />}
            factory={(
                <GtkSignalListItemFactory
                    onSetup={(item) => {
                        if (item instanceof Gtk.ListItem) {
                            item.setChild(new Gtk.Label());
                        }
                    }}
                    onBind={(item) => {
                        const value = item instanceof Gtk.ListItem ? item.getItem() : null;
                        const child = item instanceof Gtk.ListItem ? item.getChild() : null;

                        if (!(value instanceof Gtk.StringObject) || !(child instanceof Gtk.Label)) {
                            throw new TypeError(UNRESOLVED + "Gtk.StringObject");
                        }

                        child.setLabel(value.getString());
                    }}
                />
            )}
        />
    </GtkScrolledWindow>
);

const Fields = () => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
        <GtkEntry
            placeholderText="Name"
            ref={(entry) => {
                if (entry !== null && !(entry.getBuffer() instanceof Gtk.EntryBuffer)) {
                    throw new TypeError(UNRESOLVED + "Gtk.EntryBuffer");
                }
            }}
        />
        <GtkSearchEntry placeholderText="Search" />
        <GtkDropDown model={<GtkStringList strings={ITEMS} />} />
        <GtkFrame label="Notes">
            <GtkTextView
                monospace
                ref={(view) => {
                    if (view !== null && !(view.getBuffer() instanceof Gtk.TextBuffer)) {
                        throw new TypeError(UNRESOLVED + "Gtk.TextBuffer");
                    }
                }}
            />
        </GtkFrame>
    </GtkBox>
);

const MainWindow = () => {
    const [isNoticeRevealed, setIsNoticeRevealed] = useState(true);

    return (
        <GtkApplicationWindow
            title="Release E2E"
            defaultWidth={640}
            defaultHeight={520}
            titlebar={<Titlebar />}
            actions={<GSimpleAction name="reset" onActivate={() => setIsNoticeRevealed((shown) => !shown)} />}
            onCloseRequest={quit}
            ref={(window) => {
                if (window !== null && !(window.getDisplay() instanceof Gdk.Display)) {
                    throw new TypeError(UNRESOLVED + "Gdk.Display");
                }
            }}
        >
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={16}
                marginTop={16}
                marginBottom={16}
                marginStart={16}
                marginEnd={16}
            >
                <AdwBanner title="Built from the published packages" revealed={isNoticeRevealed} />
                <Counter />
                <Gauges />
                <GtkStack vexpand>
                    <GtkStackPage name="items" title="Items">
                        <Items />
                    </GtkStackPage>
                    <GtkStackPage name="details" title="Details">
                        <Details />
                    </GtkStackPage>
                    <GtkStackPage name="fields" title="Fields">
                        <Fields />
                    </GtkStackPage>
                </GtkStack>
            </GtkBox>
        </GtkApplicationWindow>
    );
};

export const App = () => (
    <GtkApplication>
        <MainWindow />
    </GtkApplication>
);

export default App;
`;

/* eslint-enable unicorn/no-incorrect-template-string-interpolation */

function runCapture(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args);
        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString("utf8");
        });

        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString("utf8");
        });

        child.on("error", reject);

        child.on("close", (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(
                    new Error(
                        `Command failed with exit code ${String(code ?? "unknown")}: ` +
                        `${command} ${args.join(" ")}\n${stderr}`,
                    ),
                );
            }
        });
    });
}

function createGtkxVersion(): string {
    const manifestPath = join(PACKAGES_DIR, "create-gtkx", "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;

    if (typeof manifest.version !== "string") {
        throw new TypeError(`create-gtkx has no version in ${manifestPath}`);
    }

    return manifest.version;
}

function publishableName(entry: string): string | undefined {
    const manifestPath = join(PACKAGES_DIR, entry, "package.json");

    if (!existsSync(manifestPath)) {
        return undefined;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;

    if (manifest.private === true) {
        return undefined;
    }

    return typeof manifest.name === "string" ? manifest.name : undefined;
}

function publishablePackageNames(): string[] {
    return readdirSync(PACKAGES_DIR)
        .map((entry) => publishableName(entry))
        .filter((name): name is string => name !== undefined);
}

async function tarballUrl(name: string): Promise<string> {
    const response = await fetch(`${REGISTRY}${name}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch packument for ${name}: HTTP ${String(response.status)}`);
    }

    const packument = (await response.json()) as Packument;
    const latest = packument["dist-tags"].latest;

    if (latest === undefined) {
        throw new Error(`Registry reports no latest version for ${name}`);
    }

    const version = packument.versions[latest];

    if (version === undefined) {
        throw new Error(`Registry is missing the manifest for ${name}@${latest}`);
    }

    return version.dist.tarball;
}

async function inspectTarball(
    name: string,
    inspectDir: string,
): Promise<{ entries: string[]; manifest: PackageManifest; maps: Record<string, string> }> {
    const response = await fetch(await tarballUrl(name));

    if (!response.ok) {
        throw new Error(`Failed to download the tarball for ${name}: HTTP ${String(response.status)}`);
    }

    const tarballPath = join(inspectDir, "package.tgz");
    writeFileSync(tarballPath, Buffer.from(await response.arrayBuffer()));
    const listing = await runCapture("tar", ["-tzf", tarballPath]);

    const entries = listing
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const manifest = JSON.parse(
        await runCapture("tar", ["-xzOf", tarballPath, "package/package.json"]),
    ) as PackageManifest;

    const maps: Record<string, string> = {};
    const mapEntries = entries.filter((entry) => entry.endsWith(".map"));

    if (mapEntries.length > 0) {
        await runAsync("tar", ["-xzf", tarballPath, "-C", inspectDir, ...mapEntries], {});

        for (const entry of mapEntries) {
            maps[entry] = readFileSync(join(inspectDir, entry), "utf8");
        }
    }

    return { entries, manifest, maps };
}

async function verifyPublishedShapes(inspectDir: string): Promise<void> {
    const names = publishablePackageNames();

    for (const name of names) {
        const { entries, manifest, maps } = await inspectTarball(name, inspectDir);
        assertPublishedShape({ name, entries, manifest, maps });
    }

    console.log(`release-e2e: verified the published shape of ${String(names.length)} packages`);
}

function widenConsumerApp(appDir: string, variant: ConsumerVariant): void {
    const configPath = join(appDir, variant.isTypescript ? "gtkx.config.ts" : "gtkx.config.js");
    const config = readFileSync(configPath, "utf8");

    if (!config.includes(SCAFFOLDED_LIBRARIES)) {
        throw new Error(`Expected ${configPath} to declare ${SCAFFOLDED_LIBRARIES}`);
    }

    writeFileSync(configPath, config.replace(SCAFFOLDED_LIBRARIES, "libraries: [\"Gtk-4.0\", \"Adw-1\"],"));
    writeFileSync(join(appDir, "src", variant.isTypescript ? "app.tsx" : "app.jsx"), CONSUMER_APP_SOURCE);
}

async function verifyConsumer(consumerRoot: string, env: NodeJS.ProcessEnv, variant: ConsumerVariant): Promise<void> {
    const language = variant.isTypescript ? "TypeScript" : "JavaScript";

    const scaffoldArgs = [
        "create",
        `gtkx@${createGtkxVersion()}`,
        variant.appName,
        "--",
        "--application-id",
        variant.applicationId,
        "--package-manager",
        "npm",
        "--vitest",
    ];

    if (!variant.isTypescript) {
        scaffoldArgs.push("--no-typescript");
    }

    await runAsync("npm", scaffoldArgs, { cwd: consumerRoot, env });
    const appDir = join(consumerRoot, variant.appName);
    widenConsumerApp(appDir, variant);
    await runAsync("npm", ["run", "build"], { cwd: appDir, env });
    await verifyBuiltAppStarts(appDir);

    if (variant.isTypescript) {
        await runAsync("npm", ["run", "typecheck"], { cwd: appDir, env });
    }

    await runAsync("npm", ["test"], { cwd: appDir, env });
    console.log(`release-e2e: ${language} consumer scaffold, build, run, and test succeeded`);
}

async function main(): Promise<void> {
    const consumerRoot = mkdtempSync(join(tmpdir(), "gtkx-consumer-"));

    try {
        await withRegistry(async ({ env, registryDir }: RegistryContext) => {
            await verifyPublishedShapes(registryDir);

            for (const variant of CONSUMER_VARIANTS) {
                await verifyConsumer(consumerRoot, env, variant);
            }
        });
    } finally {
        rmSync(consumerRoot, { recursive: true, force: true });
    }
}

await main();
