import type * as Gio from "@gtkx/gi/gio";
import type { SettingsSchema } from "@gtkx/react/internal";
import type { RefCallback } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkSwitch } from "@gtkx/jsx/gtk";
import { useBindSetting, useProperty, useSetting, useSignal } from "@gtkx/react";
import { act, render, renderHook, screen, userEvent } from "@gtkx/testing";
import { createRef, useLayoutEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { renderSettings } from "../helpers/settings.js";

const SCHEMA: SettingsSchema<{ enabled: "b"; count: "i" }> = {
    id: "com.gtkx.test.useSetting",
    path: null,
    keys: { enabled: "b", count: "i" },
};

const PropertyProbe = ({ identity, isMounted = true }: { identity: string; isMounted?: boolean }) => {
    const [object, setObject] = useState<Gtk.Label | null>(null);
    const value = useProperty(object, "label");

    return (
        <GtkBox>
            {isMounted && <GtkLabel key={identity} ref={setObject} label={identity} name="source" />}
            <GtkLabel name="observed" label={value ?? "absent"} />
        </GtkBox>
    );
};

const SignalProbe = ({ identity, seen }: { identity: string; seen: string[] }) => {
    const [object, setObject] = useState<Gtk.Button | null>(null);
    useSignal(object, "clicked", () => {
        seen.push(identity);
    });

    return <GtkButton key={identity} ref={setObject} label={identity} />;
};

const BindingProbe = ({ identity, settings }: { identity: string; settings: Gio.Settings }) => {
    const [object, setObject] = useState<Gtk.Switch | null>(null);
    useBindSetting({ settings, schema: SCHEMA, key: "enabled", object, property: "active" });

    return <GtkSwitch key={identity} ref={setObject} name="bound" />;
};

describe("hook targets during JSX commits", () => {
    it("reads a property when its JSX ref first attaches", async () => {
        await render(<PropertyProbe identity="first" />);

        expect(screen.getByName("observed")).toHaveTextContent("first");
    });

    it("follows a property target replaced and removed by its parent", async () => {
        const { rerender } = await render(<PropertyProbe identity="first" />);
        await rerender(<PropertyProbe identity="first" />);
        expect(screen.getByName("observed")).toHaveTextContent("first");
        await rerender(<PropertyProbe identity="second" />);

        expect(screen.getByName("observed")).toHaveTextContent("second");
        await rerender(<PropertyProbe identity="second" isMounted={false} />);
        expect(screen.getByName("observed")).toHaveTextContent("absent");
    });

    it("follows a signal target replaced through the same JSX ref", async () => {
        const seen: string[] = [];
        const { rerender } = await render(<SignalProbe identity="first" seen={seen} />);
        const first = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "first", as: Gtk.Button });
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "first" }));
        expect(seen).toEqual(["first"]);
        await rerender(<SignalProbe identity="second" seen={seen} />);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "second" }));

        expect(seen).toEqual(["first", "second"]);
        await act(() => {
            first.emit("clicked");
        });
        expect(seen).toEqual(["first", "second"]);
    });

    it("follows a target replaced from child state", async () => {
        const seen: string[] = [];
        const Child = ({ target }: { target: RefCallback<Gtk.Button> }) => {
            const [identity, setIdentity] = useState("first");

            return (
                <GtkBox>
                    <GtkButton key={identity} ref={target} label={identity} />
                    <GtkButton
                        label="Replace"
                        onClicked={() => {
                            setIdentity("second");
                        }}
                    />
                </GtkBox>
            );
        };
        const Parent = () => {
            const [object, setObject] = useState<Gtk.Button | null>(null);
            useSignal(object, "clicked", () => {
                seen.push("clicked");
            });

            return <Child target={setObject} />;
        };

        await render(<Parent />);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "first" }));
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Replace" }));
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "second" }));

        expect(seen).toEqual(["clicked", "clicked"]);
    });

    it("moves a settings binding to a replacement JSX target", async () => {
        const settings = await renderSettings(SCHEMA.id);
        settings.setBoolean("enabled", true);
        const { rerender } = await render(<BindingProbe identity="first" settings={settings} />);
        expect(screen.getByName("bound")).toHaveObjectProperty("active", true);
        await rerender(<BindingProbe identity="second" settings={settings} />);

        expect(screen.getByName("bound")).toHaveObjectProperty("active", true);
        settings.reset("enabled");
    });
});

describe("hook subscription ordering", () => {
    it("observes a native property change between render and subscription", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} label="before" />);
        const label = ref.current;
        if (label === null) {
            throw new Error("Label did not mount");
        }
        const Probe = () => {
            const value = useProperty(label, "label");
            useLayoutEffect(() => {
                label.setLabel("committed");
            }, []);

            return <GtkLabel name="observed" label={value} />;
        };

        await render(<Probe />);

        expect(screen.getByName("observed")).toHaveTextContent("committed");
    });

    it("observes a setting changed between render and subscription", async () => {
        const settings = await renderSettings(SCHEMA.id);
        settings.reset("count");
        const Probe = () => {
            const [count] = useSetting(settings, SCHEMA, "count");
            useLayoutEffect(() => {
                settings.setInt("count", 7);
            }, []);

            return <GtkLabel name="observed" label={String(count)} />;
        };

        await render(<Probe />);

        expect(screen.getByName("observed")).toHaveTextContent("7");
        settings.reset("count");
    });

    it("disconnects a signal if its immediate handler throws during mount", async () => {
        const ref = createRef<Gtk.Button>();
        await render(<GtkButton ref={ref} label="target" />);
        let calls = 0;
        await expect(renderHook(() => {
            useSignal(ref.current, "clicked", () => {
                calls += 1;
                if (calls === 1) {
                    throw new Error("Immediate handler failed");
                }
            }, { isImmediate: true });
        })).rejects.toThrow();

        await act(() => ref.current?.emit("clicked"));

        expect(calls).toBe(1);
    });
});
