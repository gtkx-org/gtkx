import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, screenshot, userEvent, waitFor, within } from "@gtkx/testing";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import animatedGpaPath from "../../../data/demos/drawing/animated.gpa?resource";
import statefulGpaPath from "../../../data/demos/drawing/stateful.gpa?resource";
import { paintableSvgDemo } from "../../../src/demos/drawing/paintable-svg.js";
import { findButton, makeDialogDismissedError, renderDemo } from "../../test-utils.js";

const renderAndFindPicture = async (isReactStrictMode = false): Promise<Gtk.Picture> => {
    await renderDemo(paintableSvgDemo, { isReactStrictMode });

    return screen.findByName("picture", { as: Gtk.Picture });
};

const renderAndFindSvgPicture = async (isReactStrictMode = false): Promise<{ picture: Gtk.Picture; svg: Gtk.Svg }> => {
    const picture = await renderAndFindPicture(isReactStrictMode);

    await waitFor(() => {
        expect(picture.getPaintable()).toBeInstanceOf(Gtk.Svg);
    });

    return { picture, svg: picture.getPaintable() as Gtk.Svg };
};

const openPictureFileDialog = async (isReactStrictMode = false): Promise<Gtk.Picture> => {
    const { picture } = await renderAndFindSvgPicture(isReactStrictMode);
    const openButton = await findButton("Open");
    await userEvent.click(openButton);

    return picture;
};

describe("paintableSvgDemo rendering", () => {
    it("renders the Open button in the header bar", async () => {
        await renderDemo(paintableSvgDemo);
        const openButton = await findButton("Open");
        expect(openButton).toHaveObjectProperty("label", "_Open");
        expect(openButton).toHaveObjectProperty("useUnderline", true);
    });

    it("renders a GtkPicture displaying the SVG paintable", async () => {
        const { picture } = await renderAndFindSvgPicture();
        expect(picture).toBeRooted();
    });

    it("packs the open button into a HeaderBar titlebar", async () => {
        await renderDemo(paintableSvgDemo);
        const headerBar = await screen.findByName("paintable-svg-header", { as: Gtk.HeaderBar });
        const openButton = within(headerBar).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Open", as: Gtk.Button });
        expect(headerBar).toContainElement(openButton);
        expect(openButton).toBe(await findButton("Open"));
    });

    it("loads the bundled SVG and attaches it to the picture", async () => {
        const { svg } = await renderAndFindSvgPicture();
        expect(svg.getIntrinsicWidth()).toBe(128);
        expect(svg.getIntrinsicHeight()).toBe(128);
    });
});

describe("paintableSvgDemo open dialog", () => {
    it.each(["invalid", "missing"])("keeps the image after an %s file and allows recovery", async (kind) => {
        const directory = mkdtempSync(join(tmpdir(), "gtkx-svg-"));
        const path = join(directory, "image.svg");
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open");

        if (kind === "invalid") {
            writeFileSync(path, "<svg><not-closed");
        }

        openSpy.mockResolvedValueOnce(Gio.File.newForPath(path));
        openSpy.mockResolvedValueOnce(Gio.File.newForUri(`resource://${statefulGpaPath}`));

        try {
            const picture = await renderAndFindPicture();
            const before = await screenshot(picture);
            await userEvent.click(await findButton("Open"));
            const alert = await screen.findByRole(Gtk.AccessibleRole.ALERT_DIALOG);
            expect(picture.getPaintable()?.getIntrinsicWidth()).toBe(128);
            const after = await screenshot(picture);
            expect(after.data).toBe(before.data);
            await userEvent.click(within(alert).getByRole(Gtk.AccessibleRole.BUTTON, { name: "OK" }));
            await userEvent.click(await findButton("Open"));

            await waitFor(() => {
                expect(picture.getPaintable()?.getIntrinsicWidth()).toBe(70);
            });
        } finally {
            openSpy.mockRestore();
            rmSync(directory, { recursive: true });
        }
    });

    it("invokes the file picker and replaces the picture's paintable when a new file is chosen", async () => {
        const openSpy = vi
            .spyOn(Gtk.FileDialog.prototype, "open")
            .mockResolvedValue(Gio.File.newForUri(`resource://${animatedGpaPath}`));

        try {
            const picture = await openPictureFileDialog(true);

            await waitFor(() => {
                expect(picture.getPaintable()?.getIntrinsicWidth()).toBe(64);
                expect(picture.getPaintable()?.getIntrinsicHeight()).toBe(64);
            });
        } finally {
            openSpy.mockRestore();
        }
    });

    it("keeps the picture on dismissal and allows another file in Strict Mode", async () => {
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open");
        openSpy.mockRejectedValueOnce(makeDialogDismissedError());
        openSpy.mockResolvedValueOnce(Gio.File.newForUri(`resource://${statefulGpaPath}`));

        try {
            const picture = await openPictureFileDialog(true);
            expect(picture.getPaintable()?.getIntrinsicWidth()).toBe(128);
            expect(picture.getPaintable()?.getIntrinsicHeight()).toBe(128);
            const openButton = await findButton("Open");
            await waitFor(() => {
                expect(openButton).toBeEnabled();
            });
            await userEvent.click(openButton);
            await waitFor(() => {
                expect(picture.getPaintable()?.getIntrinsicWidth()).toBe(70);
            });
        } finally {
            openSpy.mockRestore();
        }
    });
});

describe("paintableSvgDemo gesture", () => {
    it("advances the image through keyboard activation", async () => {
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open")
            .mockResolvedValue(Gio.File.newForUri(`resource://${statefulGpaPath}`));

        try {
            const picture = await openPictureFileDialog();
            await waitFor(() => {
                expect(picture.getPaintable()?.getIntrinsicWidth()).toBe(70);
            });

            const before = await screenshot(picture);
            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Next SVG state" });
            await userEvent.keyboard(button, "{Enter}");

            await waitFor(async () => {
                const after = await screenshot(picture);
                expect(after.data).not.toBe(before.data);
            });
        } finally {
            openSpy.mockRestore();
        }
    });

    it("advances the visible SVG frame and wraps after a complete cycle", async () => {
        const openSpy = vi
            .spyOn(Gtk.FileDialog.prototype, "open")
            .mockResolvedValue(Gio.File.newForUri(`resource://${statefulGpaPath}`));

        try {
            const picture = await openPictureFileDialog();

            await waitFor(() => {
                expect(picture.getPaintable()?.getIntrinsicWidth()).toBe(70);
            });

            const initial = await screenshot(picture);
            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Next SVG state" });
            await userEvent.click(button);

            await waitFor(async () => {
                const next = await screenshot(picture);
                expect(next.data).not.toBe(initial.data);
            });

            for (let state = 1; state < 64; state++) {
                await userEvent.click(button);
            }

            await waitFor(async () => {
                const wrapped = await screenshot(picture);
                expect(wrapped.data).toBe(initial.data);
            });
        } finally {
            openSpy.mockRestore();
        }
    });
});
