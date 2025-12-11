import { AccessibleRole } from "@gtkx/ffi/gtk";
import { cleanup, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { headerBarDemo } from "../src/demos/windows/header-bar.js";
import { revealerDemo } from "../src/demos/windows/revealer.js";
import { stackDemo } from "../src/demos/windows/stack.js";

describe("Windows Demos", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("header bar demo", () => {
        const HeaderBarDemo = headerBarDemo.component;

        it("renders header bar title", async () => {
            await render(<HeaderBarDemo />);

            const title = await screen.findByText("Header Bar");
            expect(title).toBeDefined();
        });

        it("renders basic header bar section", async () => {
            await render(<HeaderBarDemo />);

            const heading = await screen.findByText("Basic Header Bar");
            const appTitle = await screen.findByText("Application Title");
            const windowContent = await screen.findByText("Window content");

            expect(heading).toBeDefined();
            expect(appTitle).toBeDefined();
            expect(windowContent).toBeDefined();
        });

        it("renders header bar with custom title section", async () => {
            await render(<HeaderBarDemo />);

            const heading = await screen.findByText("Header Bar with Custom Title");
            const myApp = await screen.findByText("My Application");
            const version = await screen.findByText("Version 1.0.0");

            expect(heading).toBeDefined();
            expect(myApp).toBeDefined();
            expect(version).toBeDefined();
        });

        it("renders search toggle example section", async () => {
            await render(<HeaderBarDemo />);

            const heading = await screen.findByText("Search Toggle Example");
            const docViewer = await screen.findByText("Document Viewer");

            expect(heading).toBeDefined();
            expect(docViewer).toBeDefined();
        });

        it("renders show search button initially", async () => {
            await render(<HeaderBarDemo />);

            const showSearchBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Show Search" });
            expect(showSearchBtn).toBeDefined();
        });

        it("shows search entry when Show Search is clicked", async () => {
            await render(<HeaderBarDemo />);

            const showSearchBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Show Search" });
            await userEvent.click(showSearchBtn);

            const searchEntry = await screen.findByRole(AccessibleRole.SEARCH_BOX);
            expect(searchEntry).toBeDefined();
        });

        it("toggles button label when search is shown", async () => {
            await render(<HeaderBarDemo />);

            const showSearchBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Show Search" });
            await userEvent.click(showSearchBtn);

            const hideSearchBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Hide Search" });
            expect(hideSearchBtn).toBeDefined();
        });

        it("hides search entry when Hide Search is clicked", async () => {
            await render(<HeaderBarDemo />);

            const showSearchBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Show Search" });
            await userEvent.click(showSearchBtn);

            const hideSearchBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Hide Search" });
            await userEvent.click(hideSearchBtn);

            const showSearchBtnAgain = await screen.findByRole(AccessibleRole.BUTTON, { name: "Show Search" });
            expect(showSearchBtnAgain).toBeDefined();

            await expect(screen.findByRole(AccessibleRole.SEARCH_BOX, { timeout: 100 })).rejects.toThrow();
        });
    });

    describe("stack demo (windows)", () => {
        const StackDemo = stackDemo.component;

        it("renders stack title", async () => {
            await render(<StackDemo />);

            const title = await screen.findByText("Stack");
            expect(title).toBeDefined();
        });

        it("renders about stack section", async () => {
            await render(<StackDemo />);

            const heading = await screen.findByText("About Stack");
            const description = await screen.findByText(
                "GtkStack is a container that shows one child at a time with animated transitions. It's commonly used for multi-page interfaces like preferences dialogs or wizard flows.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders simulated stack navigation section", async () => {
            await render(<StackDemo />);

            const heading = await screen.findByText("Simulated Stack Navigation");
            expect(heading).toBeDefined();
        });

        it("renders page buttons", async () => {
            await render(<StackDemo />);

            const page1Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 1" });
            const page2Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 2" });
            const page3Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 3" });

            expect(page1Btn).toBeDefined();
            expect(page2Btn).toBeDefined();
            expect(page3Btn).toBeDefined();
        });

        it("shows page 1 content initially", async () => {
            await render(<StackDemo />);

            const content = await screen.findByText("Content for Page 1");
            expect(content).toBeDefined();
        });

        it("switches to page 2 content when Page 2 clicked", async () => {
            await render(<StackDemo />);

            const page2Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 2" });
            await userEvent.click(page2Btn);

            const content = await screen.findByText("Content for Page 2");
            expect(content).toBeDefined();
        });

        it("switches to page 3 content when Page 3 clicked", async () => {
            await render(<StackDemo />);

            const page3Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 3" });
            await userEvent.click(page3Btn);

            const content = await screen.findByText("Content for Page 3");
            expect(content).toBeDefined();
        });

        it("can switch back to page 1 after navigating", async () => {
            await render(<StackDemo />);

            const page2Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 2" });
            await userEvent.click(page2Btn);

            const page1Btn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Page 1" });
            await userEvent.click(page1Btn);

            const content = await screen.findByText("Content for Page 1");
            expect(content).toBeDefined();
        });

        it("renders transition types section", async () => {
            await render(<StackDemo />);

            const heading = await screen.findByText("Transition Types");
            const description = await screen.findByText(
                "GtkStack supports various transition animations including: NONE, CROSSFADE, SLIDE_RIGHT, SLIDE_LEFT, SLIDE_UP, SLIDE_DOWN, and more.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders Stack.Root component section", async () => {
            await render(<StackDemo />);

            const heading = await screen.findByText("Stack.Root Component");
            const description = await screen.findByText(
                "In GTKX, use Stack.Root with Stack.VisibleChild to define the currently visible child. The Stack component supports animated transitions between pages.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });
    });

    describe("revealer demo", () => {
        const RevealerDemo = revealerDemo.component;

        it("renders revealer title", async () => {
            await render(<RevealerDemo />);

            const title = await screen.findByText("Revealer");
            expect(title).toBeDefined();
        });

        it("renders slide down section", async () => {
            await render(<RevealerDemo />);

            const heading = await screen.findByText("Slide Down");
            const showBtns = await screen.findAllByRole(AccessibleRole.BUTTON, { name: "Show" });

            expect(heading).toBeDefined();
            expect(showBtns.length).toBeGreaterThanOrEqual(1);
        });

        it("reveals slide down content when Show is clicked", async () => {
            await render(<RevealerDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON, { name: "Show" });
            const slideDownShowBtn = buttons[0];
            if (!slideDownShowBtn) throw new Error("Slide down Show button not found");

            await userEvent.click(slideDownShowBtn);

            const content = await screen.findByText("This content slides down when revealed.");
            expect(content).toBeDefined();
        });

        it("toggles slide down button label when revealed", async () => {
            await render(<RevealerDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON, { name: "Show" });
            const slideDownShowBtn = buttons[0];
            if (!slideDownShowBtn) throw new Error("Slide down Show button not found");

            await userEvent.click(slideDownShowBtn);

            const hideBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Hide" });
            expect(hideBtn).toBeDefined();
        });

        it("renders slide up section", async () => {
            await render(<RevealerDemo />);

            const heading = await screen.findByText("Slide Up");
            expect(heading).toBeDefined();
        });

        it("reveals slide up content when Show is clicked", async () => {
            await render(<RevealerDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON, { name: "Show" });
            const slideUpShowBtn = buttons[1];
            if (!slideUpShowBtn) throw new Error("Slide up Show button not found");

            await userEvent.click(slideUpShowBtn);

            const content = await screen.findByText("This content slides up!");
            expect(content).toBeDefined();
        });

        it("renders horizontal slides section", async () => {
            await render(<RevealerDemo />);

            const heading = await screen.findByText("Horizontal Slides");
            expect(heading).toBeDefined();
        });

        it("renders Show Left and Show Right buttons", async () => {
            await render(<RevealerDemo />);

            const showLeftBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Show Left" });
            const showRightBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Show Right" });

            expect(showLeftBtn).toBeDefined();
            expect(showRightBtn).toBeDefined();
        });

        it("reveals left content when Show Left is clicked", async () => {
            await render(<RevealerDemo />);

            const showLeftBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Show Left" });
            await userEvent.click(showLeftBtn);

            const content = await screen.findByText("Left content");
            expect(content).toBeDefined();
        });

        it("reveals right content when Show Right is clicked", async () => {
            await render(<RevealerDemo />);

            const showRightBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Show Right" });
            await userEvent.click(showRightBtn);

            const content = await screen.findByText("Right content");
            expect(content).toBeDefined();
        });

        it("toggles left button label when revealed", async () => {
            await render(<RevealerDemo />);

            const showLeftBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Show Left" });
            await userEvent.click(showLeftBtn);

            const hideLeftBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Hide Left" });
            expect(hideLeftBtn).toBeDefined();
        });

        it("renders crossfade section", async () => {
            await render(<RevealerDemo />);

            const heading = await screen.findByText("Crossfade");
            expect(heading).toBeDefined();
        });

        it("reveals crossfade content when Show is clicked", async () => {
            await render(<RevealerDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON, { name: "Show" });
            const crossfadeShowBtn = buttons[2];
            if (!crossfadeShowBtn) throw new Error("Crossfade Show button not found");

            await userEvent.click(crossfadeShowBtn);

            const content = await screen.findByText("This content fades in and out smoothly.");
            expect(content).toBeDefined();
        });

        it("can toggle revealer multiple times", async () => {
            await render(<RevealerDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON, { name: "Show" });
            const slideDownShowBtn = buttons[0];
            if (!slideDownShowBtn) throw new Error("Slide down Show button not found");

            await userEvent.click(slideDownShowBtn);
            const content = await screen.findByText("This content slides down when revealed.");
            expect(content).toBeDefined();

            const hideBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Hide" });
            await userEvent.click(hideBtn);

            await waitFor(async () => {
                const showBtns = await screen.findAllByRole(AccessibleRole.BUTTON, { name: "Show" });
                expect(showBtns.length).toBeGreaterThanOrEqual(1);
            });
        });
    });
});
