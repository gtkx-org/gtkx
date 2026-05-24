import * as Gtk from "@gtkx/ffi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
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
        await renderDemo(videoPlayerDemo);
        const logoButton = (await screen.findByName("logo-button")) as Gtk.Button;
        await userEvent.click(logoButton);
        const video = (await screen.findByName("video")) as Gtk.Video;
        await waitFor(() => expect(video.getFile()).not.toBeNull());
    });

    it("requests fullscreen on the host window when the Fullscreen icon button is clicked", async () => {
        await renderDemo(videoPlayerDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        const fullscreenButton = (await screen.findByName("fullscreen-button")) as Gtk.Button;
        await userEvent.click(fullscreenButton);
        expect(window).toBeInstanceOf(Gtk.Window);
    });
});
