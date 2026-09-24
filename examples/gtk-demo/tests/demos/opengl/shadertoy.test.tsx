import * as Gtk from "@gtkx/gi/gtk";
import { screen, screenshot, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { shadertoyDemo } from "../../../src/demos/opengl/shadertoy.js";
import { findButton, renderDemo, screenshotColors } from "../../test-utils.js";

const PRESET_NAMES = ["Alien Planet", "Mandelbrot", "Neon", "Cogs", "Glowing Stars"];
const RED_SHADER = `void mainImage(out vec4 fragColor, vec2 fragCoord) {
    fragColor = vec4(1.0, 0.0, 0.0, 1.0);
}`;
const GREEN_SHADER = `void mainImage(out vec4 fragColor, vec2 fragCoord) {
    fragColor = vec4(0.0, 1.0, 0.0, 1.0);
}`;
const RESTART_SHADER = `void mainImage(out vec4 fragColor, vec2 fragCoord) {
    fragColor = iTime < 1.5 ? vec4(1.0, 0.0, 0.0, 1.0) : vec4(0.0, 1.0, 0.0, 1.0);
}`;

const clickPreset = async (name: string): Promise<void> => {
    await userEvent.click(await findButton(name));
};

const renderAndFindSourceView = async (): Promise<Gtk.TextView> => {
    await renderDemo(shadertoyDemo);

    return screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
};

const replaceSource = async (sourceView: Gtk.TextView, source: string): Promise<void> => {
    await userEvent.clear(sourceView);
    await userEvent.paste(sourceView, source);
};

const waitForColor = async (glArea: Gtk.GLArea, color: string, timeout = 1000): Promise<void> => {
    await waitFor(async () => {
        expect(screenshotColors(await screenshot(glArea)).has(color)).toBe(true);
    }, { timeout });
};

vi.setConfig({ testTimeout: 30_000 });

describe("shadertoyDemo", () => {
    it("renders the selected shader in the main panel", async () => {
        await renderDemo(shadertoyDemo);
        const glArea = await screen.findByName("shadertoy-gl-area", { as: Gtk.GLArea });

        await waitFor(() => {
            expect(glArea.getWidth()).toBeGreaterThan(0);
        });

        expect(screenshotColors(await screenshot(glArea)).size).toBeGreaterThan(8);
    });

    it("seeds the source editor with the Alien Planet fragment shader", async () => {
        const sourceView = await renderAndFindSourceView();
        expect(await screen.findByDisplayValue(/MAX_DISTANCE/)).toBe(sourceView);
        expect(sourceView).toHaveDisplayValue(/mountainColor/);
        expect(sourceView).toHaveDisplayValue(/void mainImage/);
    });
});

describe("shadertoyDemo shader presets", () => {
    it("exposes Restart, Clear, and one button per shader preset", async () => {
        await renderDemo(shadertoyDemo);
        expect(await findButton("Restart the demo")).toBeEnabled();
        expect(await findButton("Clear the text view")).toBeEnabled();

        for (const presetName of PRESET_NAMES) {
            expect(await findButton(presetName)).toBeEnabled();
        }
    });
});

describe("shadertoyDemo editor", () => {
    it("clears the editor buffer when the Clear button is activated", async () => {
        expect(await renderAndFindSourceView()).toHaveDisplayValue(/void mainImage/);
        await userEvent.click(await findButton("Clear the text view"));

        await waitFor(() => {
            expect(screen.queryByDisplayValue(/.+/)).toBeNull();
        });
    });

    it("loads each preset shader into the buffer when its button is activated", async () => {
        await renderAndFindSourceView();
        await screen.findByDisplayValue(/MAX_DISTANCE/);
        await clickPreset("Mandelbrot");
        await screen.findByDisplayValue(/MANDELBROT_ITER/);
        expect(screen.queryByDisplayValue(/MAX_DISTANCE/)).toBeNull();
        await clickPreset("Neon");
        await screen.findByDisplayValue(/sunEffect/);
        expect(screen.queryByDisplayValue(/MANDELBROT_ITER/)).toBeNull();
        await clickPreset("Cogs");
        await screen.findByDisplayValue(/cogwheel/);
        expect(screen.queryByDisplayValue(/sunEffect/)).toBeNull();
        await clickPreset("Glowing Stars");
        await screen.findByDisplayValue(/planeCol/);
        expect(screen.queryByDisplayValue(/cogwheel/)).toBeNull();
        await clickPreset("Alien Planet");
        await screen.findByDisplayValue(/MAX_DISTANCE/);
        expect(screen.queryByDisplayValue(/planeCol/)).toBeNull();
    });

    it("propagates user edits to the buffer", async () => {
        const sourceView = await renderAndFindSourceView();
        await userEvent.clear(sourceView);
        await userEvent.type(sourceView, "// custom shader");
        expect(await screen.findByDisplayValue("// custom shader")).toBe(sourceView);
    });

    it("shows a shader failure and recovers after valid source is run", async () => {
        const sourceView = await renderAndFindSourceView();
        const glArea = await screen.findByName("shadertoy-gl-area", { as: Gtk.GLArea });
        await replaceSource(sourceView, RED_SHADER);
        await userEvent.click(await findButton("Restart the demo"));
        await waitForColor(glArea, "255,0,0,255");
        const valid = await screenshot(glArea);
        await replaceSource(sourceView, "void mainImage(");
        await userEvent.click(await findButton("Restart the demo"));

        await waitFor(async () => {
            const failed = await screenshot(glArea);
            expect(failed.data).not.toBe(valid.data);
        });

        await replaceSource(sourceView, GREEN_SHADER);
        await userEvent.click(await findButton("Restart the demo"));
        await waitForColor(glArea, "0,255,0,255");
    });

    it("restarts an unchanged shader from its first frame", async () => {
        const sourceView = await renderAndFindSourceView();
        const glArea = await screen.findByName("shadertoy-gl-area", { as: Gtk.GLArea });
        await replaceSource(sourceView, RESTART_SHADER);
        const restart = await findButton("Restart the demo");
        expect(restart).toBeEnabled();
        await userEvent.click(restart);
        await waitForColor(glArea, "255,0,0,255");
        await waitForColor(glArea, "0,255,0,255", 3000);
        await userEvent.click(restart);
        await waitForColor(glArea, "255,0,0,255");
    });
});
