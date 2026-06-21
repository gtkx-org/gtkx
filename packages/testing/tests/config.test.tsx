import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { afterEach, describe, expect, it } from "vitest";
import { configure, findByRole, getConfig, render } from "../src/index.js";

const initialConfig = { ...getConfig() };

function setupConfigReset() {
    afterEach(() => {
        configure(initialConfig);
    });
}

describe("configure defaults", () => {
    setupConfigReset();

    it("has default configuration", () => {
        const config = getConfig();

        expect(config.showSuggestions).toBe(true);
        expect(config.getElementError).toBeDefined();
    });
});

describe("configure updates", () => {
    setupConfigReset();

    it("updates configuration with partial object", () => {
        configure({ showSuggestions: false });

        const config = getConfig();
        expect(config.showSuggestions).toBe(false);
    });

    it("updates configuration with function", () => {
        configure((current) => ({
            showSuggestions: !current.showSuggestions,
        }));

        const config = getConfig();
        expect(config.showSuggestions).toBe(false);
    });
});

describe("configure suggestions", () => {
    setupConfigReset();

    it.each([
        {
            title: "disables suggestions in error messages when showSuggestions is false",
            showSuggestions: false,
            assertMessage: (message: string) => {
                expect(message).not.toContain("Here are the accessible roles:");
            },
        },
        {
            title: "includes suggestions in error messages when showSuggestions is true",
            showSuggestions: true,
            assertMessage: (message: string) => {
                expect(message).toContain("Here are the accessible roles:");
            },
        },
    ])("$title", async ({ showSuggestions, assertMessage }) => {
        configure({ showSuggestions });

        const { container } = await render(<GtkLabel label="Test" />);

        try {
            await findByRole(container, Gtk.AccessibleRole.BUTTON, { timeout: 100 });
        } catch (error) {
            assertMessage((error as Error).message);
        }
    });
});

describe("configure error factory", () => {
    setupConfigReset();

    it("allows custom error factory for query errors", async () => {
        class CustomError extends Error {
            constructor(message: string) {
                super(message);
                this.name = "CustomError";
            }
        }

        configure({
            getElementError: (message) => new CustomError(message),
        });

        const { container } = await render(<GtkLabel label="Test" />);

        try {
            await findByRole(container, Gtk.AccessibleRole.BUTTON, { timeout: 100 });
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain("Unable to find an element with role 'BUTTON'");
        }
    });
});
