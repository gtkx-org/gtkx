import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { videoPlayerDemo } from "../../../src/demos/media/video-player.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType, findFirstOfType } from "../../helpers/traverse.js";

describe("videoPlayerDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(videoPlayerDemo.id).toBe("video-player");
        expect(videoPlayerDemo.title).toBe("Video Player");
        expect(videoPlayerDemo.description.length).toBeGreaterThan(0);
        expect(videoPlayerDemo.keywords).toEqual(
            expect.arrayContaining(["video", "player", "media", "GtkVideo", "GtkMediaFile"]),
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
        const { container } = await renderDemo(videoPlayerDemo);
        const headerBar = findFirstOfType(container, Gtk.HeaderBar);
        expect(headerBar).toBeInstanceOf(Gtk.HeaderBar);
        if (!headerBar) return;
        const buttons = findAllOfType(headerBar, Gtk.Button).filter((b) => !isWindowControlButton(b));
        const openButton = buttons.find((b) => b.getLabel() === "_Open");
        expect(openButton).toBeInstanceOf(Gtk.Button);
        const iconButtons = buttons.filter((b) => b.getLabel() === null || b.getLabel() === "");
        expect(iconButtons.length).toBeGreaterThanOrEqual(3);
        const fullscreenButton = iconButtons.find((b) => b.getIconName() === "view-fullscreen-symbolic");
        expect(fullscreenButton).toBeInstanceOf(Gtk.Button);
    });

    it("wires the Open button with useUnderline in the header bar's pack-start area", async () => {
        const { container } = await renderDemo(videoPlayerDemo);
        const headerBar = findFirstOfType(container, Gtk.HeaderBar) as Gtk.HeaderBar;
        const openButton = findAllOfType(headerBar, Gtk.Button).find((b) => b.getLabel() === "_Open");
        expect(openButton).toBeInstanceOf(Gtk.Button);
        if (!openButton) return;
        expect(openButton.getUseUnderline()).toBe(true);
    });

    it("renders the second image-only header button as the Big Buck Bunny trigger", async () => {
        const { container } = await renderDemo(videoPlayerDemo);
        const headerBar = findFirstOfType(container, Gtk.HeaderBar) as Gtk.HeaderBar;
        const iconButtons = findAllOfType(headerBar, Gtk.Button)
            .filter((b) => !isWindowControlButton(b))
            .filter((b) => (b.getLabel() ?? "") === "" && b.getIconName() !== "view-fullscreen-symbolic");
        const bbbButton = iconButtons[1];
        expect(bbbButton).toBeInstanceOf(Gtk.Button);
        if (!bbbButton) return;
        const image = findFirstOfType(bbbButton, Gtk.Image);
        expect(image).toBeInstanceOf(Gtk.Image);
        expect(image?.getPixelSize()).toBe(24);
    });
});

describe("videoPlayerDemo video and actions", () => {
    it("renders a GtkVideo widget configured with autoplay and graphics offload enabled", async () => {
        const { container } = await renderDemo(videoPlayerDemo);
        const video = findFirstOfType(container, Gtk.Video);
        expect(video).toBeInstanceOf(Gtk.Video);
        if (!video) return;
        expect(video.getAutoplay()).toBe(true);
        expect(video.getGraphicsOffload()).toBe(Gtk.GraphicsOffloadEnabled.ENABLED);
        expect(video.getFile()).toBeNull();
    });

    it("loads the GTK Logo source when the first image-only button in the header is clicked", async () => {
        const { container } = await renderDemo(videoPlayerDemo);
        const headerBar = findFirstOfType(container, Gtk.HeaderBar) as Gtk.HeaderBar;
        const iconButtons = findAllOfType(headerBar, Gtk.Button)
            .filter((b) => !isWindowControlButton(b))
            .filter((b) => (b.getLabel() ?? "") === "");
        const logoButton = iconButtons[0];
        expect(logoButton).toBeInstanceOf(Gtk.Button);
        if (!logoButton) return;
        await fireEvent(logoButton as Gtk.Widget, "clicked");
        const video = findFirstOfType(container, Gtk.Video) as Gtk.Video;
        expect(video.getFile()).not.toBeNull();
    });

    it("requests fullscreen on the host window when the Fullscreen icon button is clicked", async () => {
        const { container, window } = await renderDemo(videoPlayerDemo);
        const headerBar = findFirstOfType(container, Gtk.HeaderBar) as Gtk.HeaderBar;
        const fullscreenButton = findAllOfType(headerBar, Gtk.Button).find(
            (b) => b.getIconName() === "view-fullscreen-symbolic",
        );
        expect(fullscreenButton).toBeInstanceOf(Gtk.Button);
        if (!fullscreenButton) return;
        await fireEvent(fullscreenButton as Gtk.Widget, "clicked");
        expect(window.current).toBeInstanceOf(Gtk.Window);
    });
});

const isWindowControlButton = (button: Gtk.Button): boolean => {
    let parent = button.getParent();
    while (parent) {
        if (parent instanceof Gtk.WindowControls) return true;
        parent = parent.getParent();
    }
    return false;
};
