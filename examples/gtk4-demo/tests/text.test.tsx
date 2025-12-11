import { cleanup, render, screen } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { textViewDemo } from "../src/demos/text/text-view.js";

describe("Text Demos", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("text view demo", () => {
        const TextViewDemo = textViewDemo.component;

        it("renders text view title", async () => {
            await render(<TextViewDemo />);

            const title = await screen.findByText("Text View");
            expect(title).toBeDefined();
        });

        it("renders about textview section", async () => {
            await render(<TextViewDemo />);

            const heading = await screen.findByText("About TextView");
            const description = await screen.findByText(
                "GtkTextView is a multi-line text editor widget. It supports rich text formatting, undo/redo, and can be used for code editors, notes, and more.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders basic text editor section", async () => {
            await render(<TextViewDemo />);

            const heading = await screen.findByText("Basic Text Editor");
            expect(heading).toBeDefined();
        });

        it("renders monospace / code editor section", async () => {
            await render(<TextViewDemo />);

            const heading = await screen.findByText("Monospace / Code Editor");
            const description = await screen.findByText("Use monospace font for code editing.");

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders read-only text section", async () => {
            await render(<TextViewDemo />);

            const heading = await screen.findByText("Read-Only Text");
            expect(heading).toBeDefined();
        });

        it("renders properties section", async () => {
            await render(<TextViewDemo />);

            const heading = await screen.findByText("Properties");
            const description = await screen.findByText(
                "Key properties: editable, wrapMode (NONE, CHAR, WORD, WORD_CHAR), monospace, cursorVisible, leftMargin, rightMargin.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });
    });
});
