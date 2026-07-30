import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { useSignal } from "@gtkx/react";
import { act, render, renderHook, screen, waitFor } from "@gtkx/testing";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

const LATE_UPDATE_DELAY = 20;

describe("useSignal (emission)", () => {
    it("fires the handler on emission", async () => {
        const button = new Gtk.Button();
        const handler = vi.fn();

        await renderHook(() => {
            useSignal(button, "clicked", handler);
        });

        await act(() => {
            button.emit("clicked");
        });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("reads the latest handler without resubscribing", async () => {
        const button = new Gtk.Button();
        const first = vi.fn();
        const second = vi.fn();

        const { rerender } = await renderHook(
            ({ handler }: { handler: () => void }) => {
                useSignal(button, "clicked", handler);
            },
            { initialProps: { handler: first } },
        );

        await rerender({ handler: second });

        await act(() => {
            button.emit("clicked");
        });

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it("passes the emission arguments to the handler", async () => {
        const label = new Gtk.Label();
        const names: string[] = [];

        const handler = (pspec: GObject.ParamSpec): void => {
            names.push(pspec.getName());
        };

        await renderHook(() => {
            useSignal(label, "notify", handler);
        });

        await act(() => {
            label.setLabel("changed");
        });

        await waitFor(() => {
            expect(names).toContain("label");
        });
    });
});

describe("useSignal (targets)", () => {
    it("stays inactive for a null target and subscribes when one appears", async () => {
        const button = new Gtk.Button();
        const handler = vi.fn();

        const { rerender } = await renderHook(
            ({ target }: { target: Gtk.Button | null }) => {
                useSignal(target, "clicked", handler);
            },
            { initialProps: { target: null as Gtk.Button | null } },
        );

        await act(() => {
            button.emit("clicked");
        });

        expect(handler).not.toHaveBeenCalled();
        await rerender({ target: button });

        await act(() => {
            button.emit("clicked");
        });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("subscribes to the object held by a ref", async () => {
        const button = new Gtk.Button();
        const ref: { current: Gtk.Button | null } = { current: button };
        const handler = vi.fn();

        await renderHook(() => {
            useSignal(ref, "clicked", handler);
        });

        await act(() => {
            button.emit("clicked");
        });

        expect(handler).toHaveBeenCalledTimes(1);
    });
});

describe("useSignal (options and lifecycle) (1)", () => {
    it("invokes the handler immediately when immediate is set", async () => {
        const button = new Gtk.Button();
        const handler = vi.fn();

        await renderHook(() => {
            useSignal(button, "clicked", handler, { immediate: true });
        });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith();
    });

    it("subscribes detailed signal names", async () => {
        const label = new Gtk.Label();
        const handler = vi.fn();

        await renderHook(() => {
            useSignal(label, "notify::label", handler);
        });

        await act(() => {
            label.setLabel("changed");
        });

        await waitFor(() => {
            expect(handler).toHaveBeenCalled();
        });
    });
});

describe("useSignal (options and lifecycle) (2)", () => {
    it("unsubscribes on unmount", async () => {
        const button = new Gtk.Button();
        const handler = vi.fn();

        const { unmount } = await renderHook(() => {
            useSignal(button, "clicked", handler);
        });

        await unmount();

        await act(() => {
            button.emit("clicked");
        });

        expect(handler).not.toHaveBeenCalled();
    });

    it("resubscribes when the signal name changes", async () => {
        const button = new Gtk.Button();
        const handler = vi.fn();

        const { rerender } = await renderHook(
            ({ signal }: { signal: "clicked" | "activate" }) => {
                useSignal(button, signal, handler);
            },
            { initialProps: { signal: "clicked" } },
        );

        await rerender({ signal: "activate" });

        await act(() => {
            button.emit("clicked");
        });

        expect(handler).not.toHaveBeenCalled();

        await act(() => {
            button.emit("activate");
        });

        expect(handler).toHaveBeenCalledTimes(1);
    });
});

describe("useSignal (asynchronous updates)", () => {
    // A parent that publishes state asynchronously after mount — the shape of rows arriving from a fetch —
    // used to leave the connected handler pinned to the closure captured at mount. See issue #467.
    it("runs the handler from the latest render when a parent updates after mount", async () => {
        const source = new Gtk.Adjustment();
        const seen: number[] = [];

        const Child = ({ count }: { count: number }) => {
            useSignal(source, "value-changed", () => {
                seen.push(count);
            });

            return <GtkLabel>{`count ${String(count)}`}</GtkLabel>;
        };

        const Parent = () => {
            const [count, setCount] = useState(0);

            useEffect(() => {
                const timer = setTimeout(() => {
                    setCount(40);
                }, LATE_UPDATE_DELAY);

                return () => {
                    clearTimeout(timer);
                };
            }, []);

            return (
                <GtkBox>
                    <Child count={count} />
                </GtkBox>
            );
        };

        await render(<Parent />);
        expect(await screen.findByText("count 40")).toBeDefined();

        await act(() => {
            source.emit("value-changed");
        });

        expect(seen).toEqual([40]);
    });
});
