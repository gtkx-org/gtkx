import type * as Gtk from "@gtkx/ffi/gtk";
import { render, screen } from "@gtkx/testing";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { SourceViewer } from "../../src/components/source-viewer.js";
import { DemoProvider, useDemo } from "../../src/context/demo-context.js";
import type { Demo } from "../../src/demos/types.js";

const intro: Demo = { id: "intro", title: "GTK Demo", description: "Introduction", keywords: [] };

const Selector = ({ demoId }: { demoId: string | null }) => {
    const { demos, setCurrentDemo } = useDemo();
    useEffect(() => {
        const target = demoId ? (demos.find((d) => d.id === demoId) ?? null) : null;
        setCurrentDemo(target);
    }, [demoId, demos, setCurrentDemo]);
    return null;
};

describe("SourceViewer", () => {
    it("shows the 'No source' placeholder when no demo is selected", async () => {
        await render(
            <DemoProvider demos={[intro]}>
                <SourceViewer />
            </DemoProvider>,
        );
        expect(await screen.findByText("No source")).toBeDefined();
    });

    it("shows the 'No source' placeholder when the current demo has no sourceCode", async () => {
        const withoutSource: Demo = {
            id: "no-source",
            title: "Without Source",
            description: "Has no source attached",
            keywords: [],
            component: () => null,
        };
        await render(
            <DemoProvider demos={[intro, withoutSource]}>
                <Selector demoId="no-source" />
                <SourceViewer />
            </DemoProvider>,
        );
        expect(await screen.findByText("No source")).toBeDefined();
    });

    it("renders a GtkSourceView and copies the sourceCode into its buffer", async () => {
        const sourceCode = "const x = 1;\nconst y = 2;\n";
        const withSource: Demo = {
            id: "with-source",
            title: "With Source",
            description: "Has source attached",
            keywords: [],
            component: () => null,
            sourceCode,
        };
        await render(
            <DemoProvider demos={[intro, withSource]}>
                <Selector demoId="with-source" />
                <SourceViewer />
            </DemoProvider>,
        );
        const view = (await screen.findByName("source-view")) as Gtk.TextView;
        const buffer = view.getBuffer();
        const start = buffer.getStartIter();
        const end = buffer.getEndIter();
        expect(buffer.getText(start, end, false)).toBe(sourceCode);
    });
});
