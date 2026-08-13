import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, userEvent, waitFor } from "@gtkx/testing";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, type MockInstance, vi } from "vitest";
import { videoPlayerDemo } from "../../../src/demos/media/video-player.js";
import { findButton, renderDemo } from "../../test-utils.js";

type SetFileSpy = MockInstance<Gtk.Video["setFile"]>;

const FAKE_VIDEO_PATH = join(tmpdir(), "fake-video.webm");

const findAppliedFile = async (fileSpy: SetFileSpy): Promise<Gio.File> => {
    await waitFor(() => {
        expect(fileSpy).toHaveBeenCalled();
    });

    return fileSpy.mock.calls.at(-1)?.[0] as Gio.File;
};

const renderAndClickOpenButton = async (): Promise<void> => {
    await renderDemo(videoPlayerDemo);
    const openButton = await screen.findByName("open-button", { as: Gtk.Button });

    await act(async () => {
        await userEvent.click(openButton);
        await Promise.resolve();
    });
};

describe("videoPlayerDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(videoPlayerDemo.id).toBe("video-player");
        expect(videoPlayerDemo.title).toBe("Video Player");
        expect(videoPlayerDemo.description).toContain("This is a simple video player using just GTK widgets.");

        expect(videoPlayerDemo.keywords).toEqual([
            "GtkVideo",
            "GtkMediaStream",
            "GtkMediaFile",
            "GdkPaintable",
            "GtkMediaControls",
        ]);

        expect(videoPlayerDemo.sourceCode).toContain("const videoPlayerDemo: Demo = {");
        expect(videoPlayerDemo.defaultWidth).toBe(600);
        expect(videoPlayerDemo.defaultHeight).toBe(400);
        expect(videoPlayerDemo.component).toBeTypeOf("function");
    });
});

describe("videoPlayerDemo header bar", () => {
    it("renders the Open button and three labelled icon buttons in the header bar", async () => {
        await renderDemo(videoPlayerDemo);
        expect(await screen.findByName("open-button", { as: Gtk.Button })).toBe(await findButton("Open"));
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "GTK Logo" });
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Big Buck Bunny" });
        const fullscreenButton = await screen.findByName("fullscreen-button", { as: Gtk.Button });
        expect(fullscreenButton).toHaveObjectProperty("iconName", "view-fullscreen-symbolic");
    });

    it("wires the Open button with useUnderline in the header bar's pack-start area", async () => {
        await renderDemo(videoPlayerDemo);
        const openButton = await findButton("Open");
        expect(openButton).toHaveObjectProperty("useUnderline", true);
    });

    it("renders the Big Buck Bunny header button with a 24px image child", async () => {
        await renderDemo(videoPlayerDemo);
        const bbbImage = await screen.findByName("bbb-image", { as: Gtk.Image });
        expect(bbbImage).toHaveObjectProperty("pixelSize", 24);
    });

    it("toggles the fullscreen button icon to restore and back as the window fullscreen state changes", async () => {
        const isFullscreenSpy = vi.spyOn(Gtk.Window.prototype, "isFullscreen").mockReturnValue(false);

        try {
            await renderDemo(videoPlayerDemo);
            const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
            const fullscreenButton = await screen.findByName("fullscreen-button", { as: Gtk.Button });
            expect(fullscreenButton).toHaveObjectProperty("iconName", "view-fullscreen-symbolic");
            isFullscreenSpy.mockReturnValue(true);

            await act(() => {
                window.notify("fullscreened");
            });

            await waitFor(() => {
                expect(fullscreenButton).toHaveObjectProperty("iconName", "view-restore-symbolic");
            });

            isFullscreenSpy.mockReturnValue(false);

            await act(() => {
                window.notify("fullscreened");
            });

            await waitFor(() => {
                expect(fullscreenButton).toHaveObjectProperty("iconName", "view-fullscreen-symbolic");
            });
        } finally {
            isFullscreenSpy.mockRestore();
        }
    });
});

describe("videoPlayerDemo video and actions", () => {
    it(
        "renders a GtkVideo widget configured with autoplay, graphics offload enabled, and no initial file",
        async () => {
            await renderDemo(videoPlayerDemo);
            const video = await screen.findByName("video", { as: Gtk.Video });
            expect(video).toHaveObjectProperty("autoplay", true);
            expect(video).toHaveObjectProperty("graphicsOffload", Gtk.GraphicsOffloadEnabled.ENABLED);
            expect(video).toHaveObjectProperty("file", null);
        },
    );

    it("applies the GTK Logo file to the video when the Logo button is clicked", async () => {
        const setFileSpy = vi.spyOn(Gtk.Video.prototype, "setFile").mockImplementation((): void => undefined);

        try {
            await renderDemo(videoPlayerDemo);
            const logoButton = await screen.findByName("logo-button", { as: Gtk.Button });
            await userEvent.click(logoButton);
            const file = await findAppliedFile(setFileSpy);
            expect(file.getUri()).toMatch(/gtk-logo\.webm$/);
        } finally {
            setFileSpy.mockRestore();
        }
    });

    it("requests fullscreen on the host window when the Fullscreen icon button is clicked", async () => {
        const fullscreenSpy = vi.spyOn(Gtk.Window.prototype, "fullscreen").mockImplementation((): void => undefined);

        try {
            await renderDemo(videoPlayerDemo);
            const fullscreenButton = await screen.findByName("fullscreen-button", { as: Gtk.Button });
            await userEvent.click(fullscreenButton);

            await waitFor(() => {
                expect(fullscreenSpy).toHaveBeenCalled();
            });
        } finally {
            fullscreenSpy.mockRestore();
        }
    });
});

describe("videoPlayerDemo remote media", () => {
    it("applies the Big Buck Bunny remote file to the video when the BBB button is clicked", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation((): void => undefined);
        const setFileSpy = vi.spyOn(Gtk.Video.prototype, "setFile").mockImplementation((): void => undefined);

        try {
            await renderDemo(videoPlayerDemo);
            const bbbButton = await screen.findByName("bbb-button", { as: Gtk.Button });
            await userEvent.click(bbbButton);
            const file = await findAppliedFile(setFileSpy);
            expect(file.getUri()).toBe("https://download.blender.org/peach/trailer/trailer_400p.ogg");
        } finally {
            setFileSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });
});

describe("videoPlayerDemo open dialog", () => {
    it("applies the picked file to the video when the Open dialog resolves", async () => {
        const setFileSpy = vi.spyOn(Gtk.Video.prototype, "setFile").mockImplementation((): void => undefined);
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open");
        openSpy.mockResolvedValue(Gio.File.newForPath(FAKE_VIDEO_PATH));

        try {
            await renderAndClickOpenButton();

            await waitFor(() => {
                expect(openSpy).toHaveBeenCalled();
            });

            const file = await findAppliedFile(setFileSpy);
            expect(file.getPath()).toBe(FAKE_VIDEO_PATH);
        } finally {
            openSpy.mockRestore();
            setFileSpy.mockRestore();
        }
    });

    it("logs an error and leaves the video file unchanged when the open dialog is dismissed", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation((): void => undefined);
        const setFileSpy = vi.spyOn(Gtk.Video.prototype, "setFile").mockImplementation((): void => undefined);
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open");
        openSpy.mockRejectedValue(new Error("cancelled"));

        try {
            await renderAndClickOpenButton();

            await waitFor(() => {
                expect(errorSpy).toHaveBeenCalledWith("cancelled");
            });

            expect(setFileSpy).not.toHaveBeenCalled();
        } finally {
            openSpy.mockRestore();
            setFileSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });
});

describe("videoPlayerDemo fullscreen shortcut", () => {
    it("toggles the host window fullscreen state via the F11 shortcut", async () => {
        const isFullscreenSpy = vi.spyOn(Gtk.Window.prototype, "isFullscreen").mockReturnValue(false);
        const fullscreenSpy = vi.spyOn(Gtk.Window.prototype, "fullscreen").mockImplementation((): void => undefined);

        const unfullscreenSpy = vi
            .spyOn(Gtk.Window.prototype, "unfullscreen")
            .mockImplementation((): void => undefined);

        try {
            await renderDemo(videoPlayerDemo);
            const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
            await userEvent.keyboard(window, "{F11}");

            await waitFor(() => {
                expect(fullscreenSpy).toHaveBeenCalledTimes(1);
            });

            expect(unfullscreenSpy).not.toHaveBeenCalled();
            isFullscreenSpy.mockReturnValue(true);
            await userEvent.keyboard(window, "{F11}");

            await waitFor(() => {
                expect(unfullscreenSpy).toHaveBeenCalledTimes(1);
            });

            expect(fullscreenSpy).toHaveBeenCalledTimes(1);
        } finally {
            isFullscreenSpy.mockRestore();
            fullscreenSpy.mockRestore();
            unfullscreenSpy.mockRestore();
        }
    });
});
