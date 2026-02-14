import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as GdkPixbuf from "@gtkx/ffi/gdkpixbuf";
import { GtkBox } from "@gtkx/react";
import { render, tick } from "@gtkx/testing";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

const alphatestPngPath = resolve(import.meta.dirname, "../../../examples/gtk-demo/src/demos/drawing/alphatest.png");

describe("PixbufLoader progressive signals", () => {
    it("diagnose write behavior with default constructor", async () => {
        let writeResult = false;
        let writeError: string | null = null;
        let formatAfterWrite: string | null = null;
        let pixbufAfterWrite: string | null = null;
        const signalLog: string[] = [];

        const TestComponent = () => {
            useEffect(() => {
                const loader = new GdkPixbuf.PixbufLoader();
                loader.connect("size-prepared", (_self, w, h) => {
                    signalLog.push(`size-prepared: ${w}x${h}`);
                });
                loader.connect("area-prepared", () => {
                    signalLog.push("area-prepared");
                });
                loader.connect("area-updated", (_self, x, y, w, h) => {
                    signalLog.push(`area-updated: ${x},${y} ${w}x${h}`);
                });
                loader.connect("closed", () => {
                    signalLog.push("closed");
                });

                const data = readFileSync(alphatestPngPath);
                try {
                    writeResult = loader.write([...data], data.length);
                } catch (e) {
                    writeError = String(e);
                }
                signalLog.push("-- after write --");
                const fmt = loader.getFormat();
                formatAfterWrite = fmt ? fmt.getName() : null;
                const pb = loader.getPixbuf();
                pixbufAfterWrite = pb ? `${pb.getWidth()}x${pb.getHeight()}` : null;

                try {
                    loader.close();
                } catch (e) {
                    signalLog.push(`close error: ${e}`);
                }
                signalLog.push("-- after close --");
            }, []);
            return <GtkBox />;
        };

        await render(<TestComponent />);
        await tick();

        console.log("write result:", writeResult);
        console.log("write error:", writeError);
        console.log("format after write:", formatAfterWrite);
        console.log("pixbuf after write:", pixbufAfterWrite);
        console.log("signal log:", signalLog);

        expect(true).toBe(true);
    });

    it("diagnose write behavior with newWithType('png')", async () => {
        let writeResult = false;
        let writeError: string | null = null;
        let formatAfterWrite: string | null = null;
        let pixbufAfterWrite: string | null = null;
        const signalLog: string[] = [];

        const TestComponent = () => {
            useEffect(() => {
                const loader = GdkPixbuf.PixbufLoader.newWithType("png");
                loader.connect("size-prepared", (_self, w, h) => {
                    signalLog.push(`size-prepared: ${w}x${h}`);
                });
                loader.connect("area-prepared", () => {
                    signalLog.push("area-prepared");
                });
                loader.connect("area-updated", (_self, x, y, w, h) => {
                    signalLog.push(`area-updated: ${x},${y} ${w}x${h}`);
                });
                loader.connect("closed", () => {
                    signalLog.push("closed");
                });

                const data = readFileSync(alphatestPngPath);
                try {
                    writeResult = loader.write([...data], data.length);
                } catch (e) {
                    writeError = String(e);
                }
                signalLog.push("-- after write --");
                const fmt = loader.getFormat();
                formatAfterWrite = fmt ? fmt.getName() : null;
                const pb = loader.getPixbuf();
                pixbufAfterWrite = pb ? `${pb.getWidth()}x${pb.getHeight()}` : null;

                try {
                    loader.close();
                } catch (e) {
                    signalLog.push(`close error: ${e}`);
                }
                signalLog.push("-- after close --");
            }, []);
            return <GtkBox />;
        };

        await render(<TestComponent />);
        await tick();

        console.log("=== newWithType('png') ===");
        console.log("write result:", writeResult);
        console.log("write error:", writeError);
        console.log("format after write:", formatAfterWrite);
        console.log("pixbuf after write:", pixbufAfterWrite);
        console.log("signal log:", signalLog);

        expect(true).toBe(true);
    });
});
