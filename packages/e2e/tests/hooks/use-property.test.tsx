import type { ParamSpec } from "@gtkx/gi/gobject";
import type { RenderHookResult } from "@gtkx/testing";
import type { ComponentProps } from "react";
import { Object as GObject, ParamFlags, paramSpecInt, paramSpecString } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { type RefProp, useProperty } from "@gtkx/react";
import { registerClass } from "@gtkx/runtime";
import { act, render, renderHook, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";

type Reading = InstanceType<typeof Reading>;
type Gauge = InstanceType<typeof Gauge>;
type Humidity = InstanceType<typeof Humidity>;
type Annotated = InstanceType<typeof Annotated>;
type ReadingProperty = "celsius" | "dewPoint";
type HumidityProperty = "dewPoint" | "heatIndex";
type AddressableNames<T extends GObject> = keyof NonNullable<T["__properties__"]> & keyof T;
type IsConstructible<T> = T extends new (...args: never) => unknown ? true : false;
type LabelTargetProps = { object: RefProp<Gtk.Label> };
type LabelTargetResult = RenderHookResult<string | undefined, LabelTargetProps>;

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
    class Reading extends GObject {
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
    class Humidity extends GObject {
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
        abstract class Sensor extends GObject {
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
        class Drift extends GObject {
            declare dewPoint: number;
        }

        const register = (): unknown =>
            registerClass(Drift, {
                typeName: uniqueName("GtkxUsePropertyDrift"),
                properties: { dewPoint: paramSpecInt("dewPoint", null, null, 0, 255, 0, ParamFlags.READWRITE) },
            });

        expect(register).toThrow(
            "registerClass: Drift keys the property 'dewPoint' to a GObject.ParamSpec named 'dewPoint', " +
            "which is the name GObject notifies under; name the ParamSpec 'dew-point'",
        );
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
