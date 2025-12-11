import { AccessibleRole } from "@gtkx/ffi/gtk";
import { cleanup, render, screen } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { cssBasicsDemo } from "../src/demos/css/css-basics.js";
import { cssShadowsDemo } from "../src/demos/css/css-shadows.js";

describe("CSS Demos", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("css basics demo", () => {
        const CssBasicsDemo = cssBasicsDemo.component;

        it("renders css basics title", async () => {
            await render(<CssBasicsDemo />);

            const title = await screen.findByText("CSS Basics");
            expect(title).toBeDefined();
        });

        it("renders about css styling section", async () => {
            await render(<CssBasicsDemo />);

            const heading = await screen.findByText("About CSS Styling");
            const description = await screen.findByText(
                "GTK widgets can be styled using CSS. GTKX provides @gtkx/css for CSS-in-JS styling similar to Emotion.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders custom button styles section", async () => {
            await render(<CssBasicsDemo />);

            const heading = await screen.findByText("Custom Button Styles");
            expect(heading).toBeDefined();
        });

        it("renders styled buttons", async () => {
            await render(<CssBasicsDemo />);

            const successBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Success" });
            const warningBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Warning" });
            const dangerBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Danger" });

            expect(successBtn).toBeDefined();
            expect(warningBtn).toBeDefined();
            expect(dangerBtn).toBeDefined();
        });

        it("renders gradient backgrounds section", async () => {
            await render(<CssBasicsDemo />);

            const heading = await screen.findByText("Gradient Backgrounds");
            const gradientBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Gradient Button" });

            expect(heading).toBeDefined();
            expect(gradientBtn).toBeDefined();
        });

        it("renders system css classes section", async () => {
            await render(<CssBasicsDemo />);

            const heading = await screen.findByText("System CSS Classes");
            const description = await screen.findByText(
                "GTK provides built-in CSS classes: suggested-action, destructive-action, card, boxed-list, heading, dim-label, etc.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders system styled buttons", async () => {
            await render(<CssBasicsDemo />);

            const suggestedBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Suggested" });
            const destructiveBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "Destructive" });

            expect(suggestedBtn).toBeDefined();
            expect(destructiveBtn).toBeDefined();
        });
    });

    describe("css shadows demo", () => {
        const CssShadowsDemo = cssShadowsDemo.component;

        it("renders css shadows title", async () => {
            await render(<CssShadowsDemo />);

            const title = await screen.findByText("CSS Shadows");
            expect(title).toBeDefined();
        });

        it("renders about shadows section", async () => {
            await render(<CssShadowsDemo />);

            const heading = await screen.findByText("About Shadows");
            const description = await screen.findByText(
                "GTK CSS supports box-shadow for adding depth and elevation to widgets.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders shadow sizes section", async () => {
            await render(<CssShadowsDemo />);

            const heading = await screen.findByText("Shadow Sizes");
            const smallLabel = await screen.findByText("Small");
            const mediumLabel = await screen.findByText("Medium");
            const largeLabel = await screen.findByText("Large");

            expect(heading).toBeDefined();
            expect(smallLabel).toBeDefined();
            expect(mediumLabel).toBeDefined();
            expect(largeLabel).toBeDefined();
        });

        it("renders colored shadow section", async () => {
            await render(<CssShadowsDemo />);

            const heading = await screen.findByText("Colored Shadow");
            const blueGlow = await screen.findByText("Blue Glow");

            expect(heading).toBeDefined();
            expect(blueGlow).toBeDefined();
        });

        it("renders multi-layer shadow section", async () => {
            await render(<CssShadowsDemo />);

            const heading = await screen.findByText("Multi-layer Shadow");
            const layeredLabel = await screen.findByText("Layered");

            expect(heading).toBeDefined();
            expect(layeredLabel).toBeDefined();
        });
    });
});
