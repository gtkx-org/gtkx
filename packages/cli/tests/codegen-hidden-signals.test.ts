import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    ACCEPTED,
    createHiddenSignalsProject,
} from "./codegen-hidden-signals-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const OMITTED_SIGNALS = [
    ["direct", "onDirect"],
    ["named-data", "onNamedData"],
    ["alias", "onAlias"],
    ["nested", "onNested"],
    ["out-pointer", "onOutPointer"],
    ["return-pointer", "onReturnPointer"],
    ["skipped-return", "onSkippedReturn"],
    ["unknown-array", "onUnknownArray"],
    ["callback-value", "onCallbackValue"],
    ["private-signal", "onPrivateSignal"],
    ["iface-raw", "onIfaceRaw"],
    ["iface-private", "onIfacePrivate"],
] as const;

describe("generated unsupported signal omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;
    let reference: ReturnType<typeof loadApiReference>;

    beforeAll(() => {
        project = cleanup.use(createHiddenSignalsProject(
            "gtkx-cli-hidden-signal-types-",
            { "accepted.tsx": ACCEPTED },
        ));
        reference = loadApiReference({
            libraries: ["SignalPointers-1.0", "Gtk-4.0", "WebKit-6.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves typed handles, boxed bytes, real integers, arrays and supported interface signals", () => {
        expect(typecheckFile(project, "accepted.tsx")).toBe(0);
    });

    it("aligns class, interface and JSX reference signals while preserving owner precedence", () => {
        const probe = reference.lookup("SignalPointers.Probe", "class");
        const element = reference.lookup("SignalPointersProbe", "element");
        const feed = reference.lookup("SignalPointers.Feed", "interface");
        expect(probe.outcome).toBe("page");
        expect(element.outcome).toBe("page");
        expect(feed.outcome).toBe("page");
        for (const name of [
            "object", "boxed", "bytes", "byte-array", "integer", "array", "closure", "shared", "iface-safe",
        ]) {
            expect(probe).toHaveProperty("markdown", expect.stringContaining("### `" + name + "`"));
        }
        for (const [signal, prop] of OMITTED_SIGNALS) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining("### `" + signal + "`"));
            expect(element).toHaveProperty("markdown", expect.not.stringContaining("### `" + prop + "`"));
        }
        for (const name of ["onInteger", "onShared", "onIfaceSafe"]) {
            expect(element).toHaveProperty("markdown", expect.stringContaining("### `" + name + "`"));
        }
        expect(probe).toHaveProperty("markdown", expect.stringContaining("ownerCount: bigint"));
        expect(probe).toHaveProperty("markdown", expect.not.stringContaining("interfaceCount: bigint"));
        expect(feed).toHaveProperty("markdown", expect.stringContaining("interfaceCount: bigint"));
        for (const name of ["iface-raw", "iface-private"]) {
            expect(feed).toHaveProperty("markdown", expect.not.stringContaining("### `" + name + "`"));
        }
        expect(reference.lookup("SignalPointers.Predicate", "callback").outcome).toBe("page");
    });

    it("retains pointer-array handlers in class and JSX reference pages", () => {
        for (const [owner, signal, element, handler] of [
            ["Gio.Application", "open", "GApplication", "onOpen"],
            ["Gio.Settings", "change-event", "GSettings", "onChangeEvent"],
        ] as const) {
            const page = reference.lookup(owner, "class");
            const props = reference.lookup(element, "element");
            expect(page.outcome).toBe("page");
            expect(props.outcome).toBe("page");
            expect(page).toHaveProperty("markdown", expect.stringContaining("### `" + signal + "`"));
            expect(props).toHaveProperty("markdown", expect.stringContaining("### `" + handler + "`"));
        }
    });

    it("omits the installed WebKit pointer signal and non-introspectable TreeModel signal", () => {
        const history = reference.lookup("WebKit.BackForwardList", "class");
        const historyElement = reference.lookup("WebKitBackForwardList", "element");
        const treeModel = reference.lookup("Gtk.TreeModel", "interface");
        const sortedModel = reference.lookup("GtkTreeModelSort", "element");
        expect(history.outcome).toBe("page");
        expect(historyElement.outcome).toBe("page");
        expect(treeModel.outcome).toBe("page");
        expect(sortedModel.outcome).toBe("page");
        expect(history).toHaveProperty("markdown", expect.stringContaining("### `getLength`"));
        expect(history).toHaveProperty("markdown", expect.not.stringContaining("### `changed`"));
        expect(historyElement).toHaveProperty("markdown", expect.not.stringContaining("### `onChanged`"));
        expect(treeModel).toHaveProperty("markdown", expect.stringContaining("### `row-changed`"));
        expect(treeModel).toHaveProperty("markdown", expect.not.stringContaining("### `rows-reordered`"));
        expect(sortedModel).toHaveProperty("markdown", expect.stringContaining("### `onRowChanged`"));
        expect(sortedModel).toHaveProperty("markdown", expect.not.stringContaining("### `onRowsReordered`"));
    });
});
