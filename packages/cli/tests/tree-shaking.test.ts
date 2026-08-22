import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppProbe, probeAppProject, removeAppProject } from "./app-project.js";

type ProbeReport = {
    checked: number;
    marker: number;
    mounted: string[];
    unregistered: string[];
    unresolved: string[];
    inexact: string[];
    failed?: string;
};

type ProbeState = { probe: AppProbe; names: string[]; report: ProbeReport; source: string };

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const ELEMENTS_FILE = join(WORKSPACE_ROOT, "node_modules", ".gtkx", "jsx", "elements.json");
const BUILD_TIMEOUT = 300_000;
const OUT_DIR = "dist";
const BUNDLE_NAME = "bundle.mjs";
const REPORT_PREFIX = "registry-report=";
const LOCAL_BINDING_MARKER = "gtkxUnminifiedLocalMarker";

const MOUNTED = [
    "GtkLabel",
    "GtkButton",
    "GtkToggleButton",
    "GtkCheckButton",
    "GtkEntry",
    "GtkSearchEntry",
    "GtkPasswordEntry",
    "GtkSwitch",
    "GtkScale",
    "GtkProgressBar",
    "GtkSpinner",
    "GtkSeparator",
    "GtkImage",
    "GtkLevelBar",
    "GtkTextView",
    "GtkCalendar",
    "GtkDropDown",
    "GtkPicture",
    "GtkVideo",
    "GtkExpander",
    "GtkFrame",
    "GtkNotebook",
    "GtkStack",
    "GtkGrid",
    "GtkListBox",
    "GtkFlowBox",
    "GtkRevealer",
    "GtkOverlay",
    "GtkPaned",
    "GtkCenterBox",
    "GtkActionBar",
    "GtkHeaderBar",
    "GtkScrolledWindow",
    "GtkViewport",
    "GtkColumnView",
    "GtkListView",
    "GtkGridView",
    "GtkStackSwitcher",
    "GtkStackSidebar",
    "GtkMenuButton",
    "GtkLinkButton",
    "GtkFixed",
    "GtkAspectFrame",
    "GtkDrawingArea",
    "GtkGLArea",
    "GtkSourceView",
    "GtkSourceMap",
    "AdwBin",
    "AdwClamp",
    "AdwAvatar",
    "AdwBanner",
    "AdwStatusPage",
    "AdwToastOverlay",
    "AdwSpinner",
    "AdwHeaderBar",
    "AdwWindowTitle",
    "AdwCarousel",
    "AdwPreferencesPage",
    "AdwViewStack",
];

const PROBE_BODY = String.raw`
const markerCount = () => {
    let ${LOCAL_BINDING_MARKER} = 0;

    for (const name of Object.keys(ELEMENTS)) {
        if (ELEMENTS[name] !== undefined) {
            ${LOCAL_BINDING_MARKER} += 1;
        }
    }

    return ${LOCAL_BINDING_MARKER};
};

const report = { checked: 0, marker: markerCount(), mounted: [], unregistered: [], unresolved: [], inexact: [] };

const emit = (code) => {
    process.stdout.write("${REPORT_PREFIX}" + JSON.stringify(report) + "\n", () => process.exit(code));
};

const fail = (error) => {
    report.failed = String((error && error.stack) || error).slice(0, 1200);
    emit(1);
};

process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);

const resolveExactly = (name) => {
    report.checked += 1;
    const type = typeFromName(name);

    if (type === TYPE_INVALID) {
        report.unregistered.push(name);

        return;
    }

    let resolved;

    try {
        resolved = getWrapperClass(type);
    } catch {
        report.unresolved.push(name);

        return;
    }

    if (getClassType(resolved) !== type) {
        report.inexact.push(name + " -> " + typeName(getClassType(resolved)));
    }
};

const child = (name) => createElement(ELEMENTS[name], { key: name });

const tick = () => new Promise((resolve) => setTimeout(resolve, MOUNT_POLL));

const waitForChild = async (parent) => {
    const deadline = Date.now() + MOUNT_TIMEOUT;

    while (parent.getChild() === null && Date.now() < deadline) {
        await tick();
    }

    return parent.getChild();
};

const mountedTypeNames = (box) => {
    const names = [];

    for (let widget = box.getFirstChild(); widget !== null; widget = widget.getNextSibling()) {
        names.push(typeName(getInstanceType(widget)));
    }

    return names;
};

try {
    const window = new Gtk.Window({ title: "registry probe" });
    const root = createRoot(window);
    root.render(createElement(ELEMENTS.GtkBox, { orientation: Gtk.Orientation.VERTICAL }, MOUNTED.map(child)));
    report.mounted = mountedTypeNames(await waitForChild(window));

    for (const name of Object.keys(ELEMENTS)) {
        resolveExactly(name);
    }

    root.unmount();
    emit(0);
} catch (error) {
    fail(error);
}
`;

const elementNames = (): string[] => {
    const elements = JSON.parse(readFileSync(ELEMENTS_FILE, "utf8")) as { glibName: string }[];

    return elements.map(({ glibName }) => glibName);
};

const probeTables = (names: string[]): string => `import * as Gtk from "@gtkx/gi/gtk";
import { ${names.join(", ")} } from "@gtkx/jsx";
import { createRoot } from "@gtkx/react";
import { getClassType, getInstanceType, getWrapperClass, TYPE_INVALID, typeFromName, typeName } from "@gtkx/runtime";
import { createElement } from "react";

const ELEMENTS = { ${names.join(", ")} };
const MOUNTED = ${JSON.stringify(MOUNTED)};
const MOUNT_TIMEOUT = 30000;
const MOUNT_POLL = 20;
`;

const entrySource = (names: string[]): string => probeTables(names) + PROBE_BODY;

const readReport = (probe: AppProbe): ProbeReport => {
    const line = probe.run.stdout.split("\n").find((entry) => entry.startsWith(REPORT_PREFIX));

    if (line === undefined) {
        throw new Error(
            `the probe bundle printed no registry report: ${probe.run.stdout.slice(-800)}\n` +
            probe.run.stderr.slice(-2000),
        );
    }

    return JSON.parse(line.slice(REPORT_PREFIX.length)) as ProbeReport;
};

describe("gtkx build (wrapper class registry)", () => {
    const state: ProbeState = {
        probe: {
            emitted: [],
            project: { root: "", entry: "" },
            reported: "",
            run: { status: null, stdout: "", stderr: "" },
        },
        names: [],
        report: { checked: 0, marker: 0, mounted: [], unregistered: [], unresolved: [], inexact: [] },
        source: "",
    };

    beforeAll(async () => {
        state.names = elementNames();

        state.probe = await probeAppProject({
            applicationId: "com.gtkx.cliregistryprobe",
            entry: entrySource(state.names),
            outDir: OUT_DIR,
            packageType: "module",
            prefix: "gtkx-bundle-registry-",
        });

        state.source = readFileSync(join(state.probe.project.root, OUT_DIR, BUNDLE_NAME), "utf8");
        state.report = readReport(state.probe);
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(state.probe.project);
    });

    it("probes a bundle the build minified", () => {
        expect(state.source).not.toContain(LOCAL_BINDING_MARKER);
        expect(state.report.marker).toBe(state.names.length);
    });

    it("mounts every widget it renders as the exact type the element names", () => {
        expect(state.report.failed).toBeUndefined();
        expect(state.probe.run.status).toBe(0);
        expect(state.report.mounted).toEqual(MOUNTED);
    });

    it("resolves every element type to a wrapper class registered for that exact type", () => {
        expect(state.report.checked).toBe(state.names.length);
        expect(state.report.unregistered).toEqual([]);
        expect(state.report.unresolved).toEqual([]);
        expect(state.report.inexact).toEqual([]);
    });
});
