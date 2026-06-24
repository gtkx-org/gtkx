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

        expect(config.throwSuggestions).toBe(false);
        expect(config.getElementError).toBeDefined();
    });
});

describe("configure updates", () => {
    setupConfigReset();

    it("updates configuration with partial object", () => {
        configure({ throwSuggestions: true });

        const config = getConfig();
        expect(config.throwSuggestions).toBe(true);
    });

    it("updates configuration with function", () => {
        configure((current) => ({
            throwSuggestions: !current.throwSuggestions,
        }));

        const config = getConfig();
        expect(config.throwSuggestions).toBe(true);
    });
});

describe("configure suggestions", () => {
    setupConfigReset();

    it("includes accessible roles in error messages for failing role queries", async () => {
        const { container } = await render(<GtkLabel label="Test" />);

        try {
            await findByRole(container, Gtk.AccessibleRole.BUTTON, { timeout: 100 });
        } catch (error) {
            expect((error as Error).message).toContain("Here are the accessible roles:");
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
