import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { videoPlayerDemo } from "../../../src/demos/media/video-player.js";
import { renderDemo } from "../../test-utils.js";

const VIDEO_PATH = fileURLToPath(new URL("../../../data/demos/media/gtk-logo.webm", import.meta.url));

const renderVideo = async (): Promise<Gtk.Video> => {
    await renderDemo(videoPlayerDemo);

    return screen.findByName("video", { as: Gtk.Video });
};

describe("videoPlayerDemo", () => {
    it("enters fullscreen through the titlebar and exits with F11", async () => {
        const video = await renderVideo();
        const window = video.getRoot() as Gtk.Window;
        const fullscreenButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Fullscreen",
            as: Gtk.Button,
        });
        await userEvent.click(fullscreenButton);
        await waitFor(() => {
            expect(window.isFullscreen()).toBe(true);
        });
        expect(fullscreenButton).toHaveAccessibleName("Exit fullscreen");
        expect(fullscreenButton).toHaveObjectProperty("tooltipText", "Exit fullscreen");
        await userEvent.keyboard(video, "{F11}");
        await waitFor(() => {
            expect(window.isFullscreen()).toBe(false);
        });
        expect(fullscreenButton).toHaveAccessibleName("Fullscreen");
        expect(fullscreenButton).toHaveObjectProperty("tooltipText", "Fullscreen");
    });

    it("toggles fullscreen with F11", async () => {
        const video = await renderVideo();
        const window = video.getRoot() as Gtk.Window;
        await userEvent.keyboard(video, "{F11}");
        await waitFor(() => {
            expect(window.isFullscreen()).toBe(true);
        });
        await userEvent.keyboard(video, "{F11}");
        await waitFor(() => {
            expect(window.isFullscreen()).toBe(false);
        });
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Fullscreen" })).toBeVisible();
    });

    it("renders accessible media controls and restarts the bundled video", async () => {
        const video = await renderVideo();
        expect(video).toHaveObjectProperty("autoplay", true);
        expect(video).toHaveObjectProperty("graphicsOffload", Gtk.GraphicsOffloadEnabled.ENABLED);
        expect(video).toHaveObjectProperty("file", null);
        expect(await screen.findByRole(Gtk.AccessibleRole.GROUP, { name: "Video player", as: Gtk.Video })).toBe(video);
        await screen.findByName("open-button", { as: Gtk.Button });
        const logoButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "GTK Logo", as: Gtk.Button });
        const bbbButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Big Buck Bunny",
            as: Gtk.Button,
        });
        expect(logoButton).toHaveObjectProperty("tooltipText", "GTK Logo");
        expect(bbbButton).toHaveObjectProperty("tooltipText", "Big Buck Bunny");
        expect(logoButton.getChild()?.getAccessibleRole()).toBe(Gtk.AccessibleRole.PRESENTATION);
        expect(bbbButton.getChild()?.getAccessibleRole()).toBe(Gtk.AccessibleRole.PRESENTATION);
        await screen.findByName("fullscreen-button", { as: Gtk.Button });

        await userEvent.click(logoButton);

        await waitFor(() => {
            expect(video.getFile()?.getUri()).toMatch(/gtk-logo\.webm$/);
        });

        const firstFile = video.getFile();
        await userEvent.click(logoButton);

        await waitFor(() => {
            expect(video.getFile()).not.toBe(firstFile);
        });

        expect(video.getFile()?.getUri()).toMatch(/gtk-logo\.webm$/);
    });

    it("loads a file selected through the open dialog", async () => {
        const open = vi.spyOn(Gtk.FileDialog.prototype, "open").mockResolvedValue(Gio.File.newForPath(VIDEO_PATH));

        try {
            const video = await renderVideo();
            await userEvent.click(await screen.findByName("open-button", { as: Gtk.Button }));

            await waitFor(() => {
                expect(video.getFile()?.getPath()).toBe(VIDEO_PATH);
            });
        } finally {
            open.mockRestore();
        }
    });
});
