import * as GtkSource from "@gtkx/gi/gtksource";
import { act, render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import type { Demo } from "../../src/demos/types.js";
import { SourceViewer } from "../../src/components/source-viewer.js";
import { DemoProvider, useDemo } from "../../src/context/demo-context.js";

type DemoApi = ReturnType<typeof useDemo>;

const intro: Demo = { id: "intro", title: "GTK Demo", description: "Introduction", keywords: [] };

const renderWithSelectedDemo = async (demos: Demo[], selected: Demo): Promise<void> => {
    let demoApi: DemoApi | undefined;

    const Probe = (): null => {
        demoApi = useDemo();

        return null;
    };

    await render(
        <DemoProvider demos={demos}>
            <SourceViewer />
            <Probe />
        </DemoProvider>,
    );

    await act(() => {
        demoApi?.setCurrentDemo(selected);
    });
};

describe("SourceViewer", () => {
    it("shows the 'No source' placeholder when no demo is selected", async () => {
        await render(
            <DemoProvider demos={[intro]}>
                <SourceViewer />
            </DemoProvider>,
        );

        await screen.findByText("No source");
        expect(screen.queryByName("source-view")).toBeNull();
    });

    it("shows the 'No source' placeholder when the current demo has no sourceCode", async () => {
        const withoutSource: Demo = {
            id: "no-source",
            title: "Without Source",
            description: "Has no source attached",
            keywords: [],
            component: () => null,
        };

        await renderWithSelectedDemo([intro, withoutSource], withoutSource);
        await screen.findByText("No source");
        expect(screen.queryByName("source-view")).toBeNull();
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

        await renderWithSelectedDemo([intro, withSource], withSource);
        const view = await screen.findByDisplayValue(sourceCode);
        expect(view).toBeInstanceOf(GtkSource.View);
        expect(screen.queryByName("source-view")).toBe(view);
    });
});
