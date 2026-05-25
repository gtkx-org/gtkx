import type * as Gtk from "@gtkx/ffi/gtk";
import { act, render, renderHook, screen } from "@gtkx/testing";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { SourceViewer } from "../../src/components/source-viewer.js";
import { DemoProvider, useDemo } from "../../src/context/demo-context.js";
import type { Demo } from "../../src/demos/types.js";

const intro: Demo = { id: "intro", title: "GTK Demo", description: "Introduction", keywords: [] };

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
        const Wrapper = ({ children }: { children: ReactNode }) => (
            <DemoProvider demos={[intro, withoutSource]}>
                <SourceViewer />
                {children}
            </DemoProvider>
        );
        const { result } = await renderHook(() => useDemo(), { wrapper: Wrapper });
        await act(() => {
            result.current.setCurrentDemo(withoutSource);
        });
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
        const Wrapper = ({ children }: { children: ReactNode }) => (
            <DemoProvider demos={[intro, withSource]}>
                <SourceViewer />
                {children}
            </DemoProvider>
        );
        const { result } = await renderHook(() => useDemo(), { wrapper: Wrapper });
        await act(() => {
            result.current.setCurrentDemo(withSource);
        });
        const view = (await screen.findByName("source-view")) as Gtk.TextView;
        const buffer = view.getBuffer();
        const start = buffer.getStartIter();
        const end = buffer.getEndIter();
        expect(buffer.getText(start, end, false)).toBe(sourceCode);
    });
});
