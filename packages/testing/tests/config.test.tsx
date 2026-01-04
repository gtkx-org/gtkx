import * as Gtk from "@gtkx/ffi/gtk";
import { GtkLabel } from "@gtkx/react";
import { afterEach, describe, expect, it } from "vitest";
import { resetConfig } from "../src/config.js";
import { configure, findByRole, getConfig, render } from "../src/index.js";

describe("configure", () => {
    afterEach(() => {
        resetConfig();
    });

    it("has default configuration", () => {
        const config = getConfig();

        expect(config.showSuggestions).toBe(true);
        expect(config.getElementError).toBeDefined();
    });

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

    it("disables suggestions in error messages when showSuggestions is false", async () => {
        configure({ showSuggestions: false });

        const { container } = await render(<GtkLabel label="Test" />);

        try {
            await findByRole(container, Gtk.AccessibleRole.BUTTON, { timeout: 100 });
        } catch (error) {
            const message = (error as Error).message;
            expect(message).not.toContain("Here are the accessible roles:");
        }
    });

    it("includes suggestions in error messages when showSuggestions is true", async () => {
        configure({ showSuggestions: true });

        const { container } = await render(<GtkLabel label="Test" />);

        try {
            await findByRole(container, Gtk.AccessibleRole.BUTTON, { timeout: 100 });
        } catch (error) {
            const message = (error as Error).message;
            expect(message).toContain("Here are the accessible roles:");
        }
    });

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
