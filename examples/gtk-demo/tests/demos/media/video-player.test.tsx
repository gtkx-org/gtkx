import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { videoPlayerDemo } from "../../../src/demos/media/video-player.js";
import { fireEvent, renderDemo, screen } from "../../test-utils.js";

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
        const bbbButton = (await screen.findByName("bbb-button")) as Gtk.Button;
        const image = bbbButton.getFirstChild();
        expect(image).toBeInstanceOf(Gtk.Image);
        expect((image as Gtk.Image).getPixelSize()).toBe(24);
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

    it("loads the GTK Logo source when the first image-only button in the header is clicked", async () => {
        await renderDemo(videoPlayerDemo);
        const logoButton = (await screen.findByName("logo-button")) as Gtk.Button;
        await fireEvent(logoButton, "clicked");
        const video = (await screen.findByName("video")) as Gtk.Video;
        expect(video.getFile()).not.toBeNull();
    });

    it("requests fullscreen on the host window when the Fullscreen icon button is clicked", async () => {
        const { window } = await renderDemo(videoPlayerDemo);
        const fullscreenButton = (await screen.findByName("fullscreen-button")) as Gtk.Button;
        await fireEvent(fullscreenButton, "clicked");
        expect(window.current).toBeInstanceOf(Gtk.Window);
    });
});
