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
    it("renders its media controls and loads the bundled video", async () => {
        const video = await renderVideo();
        expect(video).toHaveObjectProperty("autoplay", true);
        expect(video).toHaveObjectProperty("graphicsOffload", Gtk.GraphicsOffloadEnabled.ENABLED);
        expect(video).toHaveObjectProperty("file", null);
        await screen.findByName("open-button", { as: Gtk.Button });
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Big Buck Bunny" });
        await screen.findByName("fullscreen-button", { as: Gtk.Button });

        await userEvent.click(await screen.findByName("logo-button", { as: Gtk.Button }));

        await waitFor(() => {
            expect(video.getFile()?.getUri()).toMatch(/gtk-logo\.webm$/);
        });
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
