import type { ParamSpec } from "@gtkx/gi/gobject";
import type { RefProp } from "@gtkx/react";
import type { RenderHookResult } from "@gtkx/testing";
import type { ComponentProps, ForwardedRef, ReactNode } from "react";
import * as GObject from "@gtkx/gi/gobject";
import { ParamFlags, paramSpecInt, paramSpecString } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { useProperty, useSignal } from "@gtkx/react";
import { registerClass } from "@gtkx/runtime";
import { act, render, renderHook, waitFor } from "@gtkx/testing";
import { createRef, forwardRef, memo } from "react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";

type Reading = InstanceType<typeof Reading>;
type Gauge = InstanceType<typeof Gauge>;
type Humidity = InstanceType<typeof Humidity>;
type Annotated = InstanceType<typeof Annotated>;
type ReadingProperty = "celsius" | "dewPoint";
type HumidityProperty = "dewPoint" | "heatIndex";
type AddressableNames<T extends GObject.Object> = keyof NonNullable<T["__properties__"]> & keyof T;
type IsConstructible<T> = T extends new (...args: never) => unknown ? true : false;
type LabelTargetProps = { object: RefProp<Gtk.Label> };
type LabelTargetResult = RenderHookResult<string | undefined, LabelTargetProps>;
type TickProbeProps = { button: Gtk.Button; tick: number; seen: number[] };

const uniqueName = createTypeNameFactory("_");

const READING_CASES: [ReadingProperty, number][] = [
    ["celsius", 21],
    ["dewPoint", 14],
];

const HUMIDITY_CASES: [HumidityProperty, number][] = [
    ["dewPoint", 12],
    ["heatIndex", 9],
];

const ANNOTATED_PROPERTIES: Record<string, ParamSpec> = {
    caption: paramSpecString("caption", null, null, "none", ParamFlags.READWRITE),
};

const Reading = registerClass(
    class Reading extends GObject.Object {
        declare celsius: number;

        declare dewPoint: number;
    },
    {
        typeName: uniqueName("GtkxUsePropertyReading"),
        properties: {
            celsius: paramSpecInt("celsius", null, null, 0, 255, 0, ParamFlags.READWRITE),
            dewPoint: paramSpecInt("dew-point", null, null, 0, 255, 0, ParamFlags.READWRITE),
        },
    },
);

const Humidity = registerClass(
    class Humidity extends GObject.Object {
        declare dewPoint: number;

        declare heatIndex: number;
    },
    {
        typeName: uniqueName("GtkxUsePropertyHumidity"),
        properties: {
            "dew-point": paramSpecInt("dew-point", null, null, 0, 255, 0, ParamFlags.READWRITE),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            heat_index: paramSpecInt("heat-index", null, null, 0, 255, 0, ParamFlags.READWRITE),
        },
    },
);

const Gauge = registerClass(
    class Gauge extends Gtk.Label {
        declare caption: string;

        tally = 0;
    },
    {
        typeName: uniqueName("GtkxUsePropertyGauge"),
        properties: { caption: paramSpecString("caption", null, null, "none", ParamFlags.READWRITE) },
    },
);

const Annotated = registerClass(
    class Annotated extends Gtk.Label {
        declare caption: string;
    },
    { typeName: uniqueName("GtkxUsePropertyAnnotated"), properties: ANNOTATED_PROPERTIES },
);

const MemoTickProbe = memo(TickProbeImpl);
const ImmediateTickProbe = memo(ImmediateTickProbeImpl);
const ForwardedTickProbe = forwardRef<Gtk.Label | null, TickProbeProps>(ForwardedTickProbeImpl);

function TickProbeImpl({ button, tick, seen }: TickProbeProps): ReactNode {
    useSignal(button, "clicked", () => {
        seen.push(tick);
    });

    return <GtkLabel>{String(tick)}</GtkLabel>;
}

function ImmediateTickProbeImpl({ button, tick, seen }: TickProbeProps): ReactNode {
    useSignal(
        button,
        "clicked",
        () => {
            seen.push(tick);
        },
        { isImmediate: true },
    );

    return <GtkLabel>{String(tick)}</GtkLabel>;
}

function ForwardedTickProbeImpl(
    { button, tick, seen }: TickProbeProps,
    ref: ForwardedRef<Gtk.Label | null>,
): ReactNode {
    useSignal(button, "clicked", () => {
        seen.push(tick);
    });

    return <GtkLabel ref={ref}>{String(tick)}</GtkLabel>;
}

function deref<T>(ref: { current: T | null }): T {
    const value = ref.current;

    if (value === null) {
        throw new Error("ref is null");
    }

    return value;
}

const renderMountedLabel = async (props: ComponentProps<typeof GtkLabel>): Promise<Gtk.Label> => {
    const ref = createRef<Gtk.Label>();
    await render(<GtkLabel ref={ref} {...props} />);

    return deref(ref);
};

const renderLabelTarget = async (object: RefProp<Gtk.Label>): Promise<LabelTargetResult> =>
    renderHook(({ object: target }: LabelTargetProps) => useProperty(target, "label"), {
        initialProps: { object },
    });

const useCelsius = (reading: Reading) => useProperty(reading, "celsius");
const useInstalledCaption = (gauge: Gauge) => useProperty(gauge, "caption");
const useInheritedLabel = (gauge: Gauge) => useProperty(gauge, "label");
const useDashedKey = (humidity: Humidity) => useProperty(humidity, "dewPoint");
const useUnderscoredKey = (humidity: Humidity) => useProperty(humidity, "heatIndex");

const useUnknownLabelProperty = (label: Gtk.Label) =>
    // @ts-expect-error "labl" is not a property of Gtk.Label
    useProperty(label, "labl");

const useMisspelledInstalledProperty = (reading: Reading) =>
    // @ts-expect-error "celsuis" is not among the properties Reading installs
    useProperty(reading, "celsuis");

const usePlainField = (gauge: Gauge) =>
    // @ts-expect-error "tally" is a plain field, not an installed property
    useProperty(gauge, "tally");

const useAnnotatedProperty = (annotated: Annotated) =>
    // @ts-expect-error a properties map annotated Record<string, ParamSpec> names nothing in particular
    useProperty(annotated, "caption");

describe("useProperty", () => {
    it("reads the initial property value", async () => {
        const label = await renderMountedLabel({ label: "Hello" });
        const { result } = await renderHook(() => useProperty(label, "label"));
        expect(result.current).toBe("Hello");
    });

    it("updates when the property changes externally", async () => {
        const label = await renderMountedLabel({ label: "Before" });
        const { result } = await renderHook(() => useProperty(label, "label"));
        expect(result.current).toBe("Before");

        await act(() => {
            label.setLabel("After");
        });

        await waitFor(() => {
            expect(result.current).toBe("After");
        });
    });

    it("reads boolean properties", async () => {
        const label = await renderMountedLabel({ visible: true, children: "Test" });
        const { result } = await renderHook(() => useProperty(label, "visible"));
        expect(result.current).toBe(true);
    });

    it("derives the notify detail from a multi-word property name", async () => {
        const label = await renderMountedLabel({ label: "Test" });
        const { result } = await renderHook(() => useProperty(label, "maxWidthChars"));
        expect(result.current).toBe(-1);

        await act(() => {
            label.setMaxWidthChars(12);
        });

        await waitFor(() => {
            expect(result.current).toBe(12);
        });
    });

    it("cleans up signal on unmount", async () => {
        const label = await renderMountedLabel({ label: "Test" });
        const { result, unmount } = await renderHook(() => useProperty(label, "label"));
        expect(result.current).toBe("Test");
        await unmount();

        await act(() => {
            label.setLabel("Changed");
        });

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(result.current).toBe("Test");
    });
});

describe("useProperty (targets)", () => {
    it("reads through a ref target and updates on change", async () => {
        const label = new Gtk.Label({ label: "Hello" });
        const ref: { current: Gtk.Label | null } = { current: label };
        const { result } = await renderHook(() => useProperty(ref, "label"));
        expect(result.current).toBe("Hello");

        await act(() => {
            label.setLabel("After");
        });

        await waitFor(() => {
            expect(result.current).toBe("After");
        });
    });

    it("follows a ref as it is populated and cleared", async () => {
        const label = new Gtk.Label({ label: "Hello" });
        const ref: { current: Gtk.Label | null } = { current: null };
        const { result, rerender } = await renderLabelTarget(ref);
        expect(result.current).toBeUndefined();
        ref.current = label;
        await rerender({ object: ref });
        expect(result.current).toBe("Hello");
        ref.current = null;
        await rerender({ object: ref });
        expect(result.current).toBeUndefined();
    });

    it("re-reads and resubscribes when the object is replaced", async () => {
        const first = new Gtk.Label({ label: "First" });
        const second = new Gtk.Label({ label: "Second" });
        const { result, rerender } = await renderLabelTarget(first);
        expect(result.current).toBe("First");
        await rerender({ object: second });
        expect(result.current).toBe("Second");

        await act(() => {
            first.setLabel("Stale");
        });

        expect(result.current).toBe("Second");
    });
});

describe("useProperty (registered classes)", () => {
    it.each(READING_CASES)("re-renders when the installed property %s changes", async (property, written) => {
        const reading = new Reading({});
        const { result } = await renderHook(() => useProperty(reading, property));
        expect(result.current).toBe(0);

        await act(() => {
            reading[property] = written;
        });

        await waitFor(() => {
            expect(result.current).toBe(written);
        });
    });

    it.each(HUMIDITY_CASES)(
        "re-renders when %s, keyed by its dashed or underscored spelling, changes",
        async (property, written) => {
            const humidity = new Humidity({});
            const { result } = await renderHook(() => useProperty(humidity, property));
            expect(result.current).toBe(0);

            await act(() => {
                humidity[property] = written;
            });

            await waitFor(() => {
                expect(result.current).toBe(written);
            });
        },
    );

    it("reads the installed and the inherited properties of a subclass", async () => {
        const gauge = new Gauge({ label: "Hello" });

        const { result } = await renderHook(() => ({
            caption: useProperty(gauge, "caption"),
            label: useProperty(gauge, "label"),
        }));

        expect(result.current).toEqual({ caption: "none", label: "Hello" });

        await act(() => {
            gauge.caption = "outside";
        });

        await waitFor(() => {
            expect(result.current).toEqual({ caption: "outside", label: "Hello" });
        });
    });
});

describe("useProperty (registration)", () => {
    it("reads an installed property on a subclass of a registered abstract class", async () => {
        abstract class Sensor extends GObject.Object {
            declare depth: number;

            abstract describe(): string;
        }

        const Abstract = registerClass(Sensor, {
            typeName: uniqueName("GtkxUsePropertySensor"),
            properties: { depth: paramSpecInt("depth", null, null, 0, 255, 0, ParamFlags.READWRITE) },
        });

        const Concrete = registerClass(
            class Concrete extends Abstract {
                override describe(): string {
                    return "concrete";
                }
            },
            { typeName: uniqueName("GtkxUsePropertyConcrete") },
        );

        expectTypeOf<IsConstructible<typeof Abstract>>().toEqualTypeOf<false>();
        expectTypeOf<IsConstructible<typeof Concrete>>().toEqualTypeOf<true>();
        const concrete = new Concrete({});
        const { result } = await renderHook(() => useProperty(concrete, "depth"));
        expect(result.current).toBe(0);

        await act(() => {
            concrete.depth = 4;
        });

        await waitFor(() => {
            expect(result.current).toBe(4);
        });
    });

    it("refuses a ParamSpec named anything but the canonical form of its key", () => {
        class Drift extends GObject.Object {
            declare dewPoint: number;
        }

        const register = (): unknown =>
            registerClass(Drift, {
                typeName: uniqueName("GtkxUsePropertyDrift"),
                properties: { dewPoint: paramSpecInt("dewPoint", null, null, 0, 255, 0, ParamFlags.READWRITE) },
            });

        expect(register).toThrow();
    });
});

describe("useProperty (addressable names)", () => {
    it("types an installed property with the value type the class declares", () => {
        expectTypeOf(useCelsius).returns.toEqualTypeOf<number | undefined>();
        expectTypeOf(useInstalledCaption).returns.toEqualTypeOf<string | undefined>();
        expectTypeOf(useInheritedLabel).returns.toEqualTypeOf<string | undefined>();
        expectTypeOf(useDashedKey).returns.toEqualTypeOf<number | undefined>();
        expectTypeOf(useUnderscoredKey).returns.toEqualTypeOf<number | undefined>();
    });

    it("names every installed property in camelCase, whichever spelling keyed it", () => {
        expectTypeOf<AddressableNames<Reading>>().toEqualTypeOf<ReadingProperty>();
        expectTypeOf<AddressableNames<Humidity>>().toEqualTypeOf<HumidityProperty>();
    });

    it("rejects a name no installed property backs", () => {
        expectTypeOf<Extract<AddressableNames<Gauge>, "caption" | "label">>().toEqualTypeOf<"caption" | "label">();
        expectTypeOf<Extract<AddressableNames<Gauge>, "tally" | "setProperty">>().toBeNever();
        expectTypeOf<Extract<AddressableNames<Gtk.Label>, "labl">>().toBeNever();
        expectTypeOf<Extract<AddressableNames<Reading>, "celsuis">>().toBeNever();
        expectTypeOf<Extract<AddressableNames<Annotated>, "caption">>().toBeNever();
        expectTypeOf(useUnknownLabelProperty).toBeFunction();
        expectTypeOf(useMisspelledInstalledProperty).toBeFunction();
        expectTypeOf(usePlainField).toBeFunction();
        expectTypeOf(useAnnotatedProperty).toBeFunction();
    });
});

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

describe("useSignal (options and lifecycle)", () => {
    it("invokes the handler immediately when isImmediate is set", async () => {
        const button = new Gtk.Button();
        const handler = vi.fn();

        await renderHook(() => {
            useSignal(button, "clicked", handler, { isImmediate: true });
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

describe("useSignal (wrapped components)", () => {
    it("runs the latest handler of a memo-wrapped component", async () => {
        const button = new Gtk.Button();
        const seen: number[] = [];
        const { rerender } = await render(<MemoTickProbe button={button} tick={1} seen={seen} />);
        await rerender(<MemoTickProbe button={button} tick={2} seen={seen} />);

        await act(() => {
            button.emit("clicked");
        });

        expect(seen).toEqual([2]);
    });

    it("runs the latest handler of a forwardRef-wrapped component", async () => {
        const button = new Gtk.Button();
        const seen: number[] = [];
        const ref = createRef<Gtk.Label>();
        const { rerender } = await render(<ForwardedTickProbe ref={ref} button={button} tick={1} seen={seen} />);
        await rerender(<ForwardedTickProbe ref={ref} button={button} tick={2} seen={seen} />);

        await act(() => {
            button.emit("clicked");
        });

        expect(deref(ref)).toBeInstanceOf(Gtk.Label);
        expect(seen).toEqual([2]);
    });

    it("does not reconnect a memo-wrapped component when only the handler changes", async () => {
        const button = new Gtk.Button();
        const seen: number[] = [];
        const { rerender } = await render(<ImmediateTickProbe button={button} tick={1} seen={seen} />);
        await rerender(<ImmediateTickProbe button={button} tick={2} seen={seen} />);

        await act(() => {
            button.emit("clicked");
        });

        expect(seen).toEqual([1, 2]);
    });

    it("reconnects a memo-wrapped component when the object changes", async () => {
        const first = new Gtk.Button();
        const second = new Gtk.Button();
        const seen: number[] = [];
        const { rerender } = await render(<MemoTickProbe button={first} tick={1} seen={seen} />);
        await rerender(<MemoTickProbe button={second} tick={2} seen={seen} />);

        await act(() => {
            first.emit("clicked");
        });

        expect(seen).toEqual([]);

        await act(() => {
            second.emit("clicked");
        });

        expect(seen).toEqual([2]);
    });

    it("stops running a memo-wrapped component's handler after unmount", async () => {
        const button = new Gtk.Button();
        const seen: number[] = [];
        const { unmount } = await render(<MemoTickProbe button={button} tick={1} seen={seen} />);
        await unmount();

        await act(() => {
            button.emit("clicked");
        });

        expect(seen).toEqual([]);
    });
});
