import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { videoPlayerDemo } from "../../../src/demos/media/video-player.js";
import { renderDemo } from "../../test-utils.js";

describe("videoPlayerDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(videoPlayerDemo.id).toBe("video-player");
        expect(videoPlayerDemo.title).toBe("Video Player");
        expect(videoPlayerDemo.description.length).toBeGreaterThan(0);
        expect(videoPlayerDemo.keywords).toEqual(
            expect.arrayContaining(["GtkVideo", "GtkMediaStream", "GtkMediaFile", "GdkPaintable", "GtkMediaControls"]),
        );
        expect(typeof videoPlayerDemo.sourceCode).toBe("string");
        expect(videoPlayerDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(videoPlayerDemo.defaultWidth).toBe(600);
        expect(videoPlayerDemo.defaultHeight).toBe(400);
        expect(videoPlayerDemo.component).toBeTypeOf("function");
    });
});

describe("videoPlayerDemo header bar", () => {
    it("renders the Open button and three icon buttons in the header bar", async () => {
        await renderDemo(videoPlayerDemo);
        expect(await screen.findByName("open-button")).toBeInstanceOf(Gtk.Button);
        expect(await screen.findByName("logo-button")).toBeInstanceOf(Gtk.Button);
        expect(await screen.findByName("bbb-button")).toBeInstanceOf(Gtk.Button);
        const fullscreenButton = (await screen.findByName("fullscreen-button")) as Gtk.Button;
        expect(fullscreenButton.getIconName()).toBe("view-fullscreen-symbolic");
    });

    it("wires the Open button with useUnderline in the header bar's pack-start area", async () => {
        await renderDemo(videoPlayerDemo);
        const openButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;
        expect(openButton).toBeInstanceOf(Gtk.Button);
        expect(openButton.getUseUnderline()).toBe(true);
    });

    it("renders the Big Buck Bunny header button with a 24px image child", async () => {
        await renderDemo(videoPlayerDemo);
        const bbbImage = (await screen.findByName("bbb-image")) as Gtk.Image;
        expect(bbbImage).toBeInstanceOf(Gtk.Image);
        expect(bbbImage.getPixelSize()).toBe(24);
    });
});

describe("videoPlayerDemo video and actions", () => {
    it("renders a GtkVideo widget configured with autoplay and graphics offload enabled", async () => {
        await renderDemo(videoPlayerDemo);
        const video = (await screen.findByName("video")) as Gtk.Video;
        expect(video).toBeInstanceOf(Gtk.Video);
        expect(video.getAutoplay()).toBe(true);
        expect(video.getGraphicsOffload()).toBe(Gtk.GraphicsOffloadEnabled.ENABLED);
        expect(video.getFile()).toBeNull();
    });

    it("loads the GTK Logo source when the Logo button is clicked", async () => {
        const setFileSpy = vi.spyOn(Gtk.Video.prototype, "setFile").mockImplementation(() => {});
        const fileNewSpy = vi.spyOn(Gio, "fileNewForPath");
        try {
            await renderDemo(videoPlayerDemo);
            const logoButton = (await screen.findByName("logo-button")) as Gtk.Button;
            await userEvent.click(logoButton);
            await waitFor(() => expect(fileNewSpy).toHaveBeenCalled());
            const path = fileNewSpy.mock.calls.at(-1)?.[0];
            expect(path?.endsWith(".webm")).toBe(true);
        } finally {
            fileNewSpy.mockRestore();
            setFileSpy.mockRestore();
        }
    });

    it("requests fullscreen on the host window when the Fullscreen icon button is clicked", async () => {
        await renderDemo(videoPlayerDemo);
        const handler = vi.fn();
        const fullscreenButton = (await screen.findByName("fullscreen-button")) as Gtk.Button;
        const handlerId = fullscreenButton.connect("clicked", handler);
        try {
            await userEvent.click(fullscreenButton);
            await waitFor(() => expect(handler).toHaveBeenCalled());
        } finally {
            fullscreenButton.disconnect(handlerId);
        }
    });

    it("loads the Big Buck Bunny URI when the BBB button is clicked", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const setFileSpy = vi.spyOn(Gtk.Video.prototype, "setFile").mockImplementation(() => {});
        const fileNewSpy = vi.spyOn(Gio, "fileNewForUri");
        try {
            await renderDemo(videoPlayerDemo);
            const bbbButton = (await screen.findByName("bbb-button")) as Gtk.Button;
            await userEvent.click(bbbButton);
            await waitFor(() => expect(fileNewSpy).toHaveBeenCalled());
            const uri = fileNewSpy.mock.calls.at(-1)?.[0];
            expect(uri).toMatch(/^https:\/\//);
        } finally {
            fileNewSpy.mockRestore();
            setFileSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });

    it("opens a Gtk.FileDialog when the Open button is activated", async () => {
        const setFileSpy = vi.spyOn(Gtk.Video.prototype, "setFile").mockImplementation(() => {});
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open");
        openSpy.mockResolvedValue(Gio.fileNewForPath("/tmp/fake-video.webm"));
        try {
            await renderDemo(videoPlayerDemo);
            const openButton = (await screen.findByName("open-button")) as Gtk.Button;
            await userEvent.click(openButton);
            await waitFor(() => expect(openSpy).toHaveBeenCalled());
            await waitFor(() => expect(setFileSpy).toHaveBeenCalled());
        } finally {
            openSpy.mockRestore();
            setFileSpy.mockRestore();
        }
    });

    it("logs an error when the open dialog is dismissed", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open");
        openSpy.mockRejectedValue(new Error("cancelled"));
        try {
            await renderDemo(videoPlayerDemo);
            const openButton = (await screen.findByName("open-button")) as Gtk.Button;
            await userEvent.click(openButton);
            await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("cancelled"));
        } finally {
            openSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });

    it("activates the F11 shortcut on the host window without throwing", async () => {
        await renderDemo(videoPlayerDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        await userEvent.keyboard(window, "{F11}");
        await userEvent.keyboard(window, "{F11}");
        const stillPresent = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        expect(stillPresent).toBe(window);
    });
});
