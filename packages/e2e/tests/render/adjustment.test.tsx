import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkScale } from "@gtkx/react";
import { render, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("render - Adjustment", () => {
    describe("AdjustableNode", () => {
        it("creates Adjustment for Scale widget", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(<GtkScale ref={ref} value={50} lower={0} upper={100} />);

            expect(ref.current).not.toBeNull();
            const adjustment = ref.current?.getAdjustment();
            expect(adjustment).not.toBeNull();
        });

        it("sets initial value", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(<GtkScale ref={ref} value={75} lower={0} upper={100} />);

            const adjustment = ref.current?.getAdjustment();
            expect(adjustment?.getValue()).toBe(75);
        });

        it("sets lower bound", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(<GtkScale ref={ref} value={50} lower={10} upper={100} />);

            const adjustment = ref.current?.getAdjustment();
            expect(adjustment?.getLower()).toBe(10);
        });

        it("sets upper bound", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(<GtkScale ref={ref} value={50} lower={0} upper={200} />);

            const adjustment = ref.current?.getAdjustment();
            expect(adjustment?.getUpper()).toBe(200);
        });

        it("sets step increment", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(<GtkScale ref={ref} value={50} lower={0} upper={100} stepIncrement={5} />);

            const adjustment = ref.current?.getAdjustment();
            expect(adjustment?.getStepIncrement()).toBe(5);
        });

        it("sets page increment", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(<GtkScale ref={ref} value={50} lower={0} upper={100} pageIncrement={20} />);

            const adjustment = ref.current?.getAdjustment();
            expect(adjustment?.getPageIncrement()).toBe(20);
        });

        it("sets page size", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(<GtkScale ref={ref} value={50} lower={0} upper={100} pageSize={10} />);

            const adjustment = ref.current?.getAdjustment();
            expect(adjustment?.getPageSize()).toBe(10);
        });

        it("updates value when prop changes", async () => {
            const ref = createRef<Gtk.Scale>();

            function App({ value }: { value: number }) {
                return <GtkScale ref={ref} value={value} lower={0} upper={100} />;
            }

            await render(<App value={25} />);
            expect(ref.current?.getAdjustment()?.getValue()).toBe(25);

            await render(<App value={75} />);
            expect(ref.current?.getAdjustment()?.getValue()).toBe(75);
        });

        it("updates lower bound when prop changes", async () => {
            const ref = createRef<Gtk.Scale>();

            function App({ lower }: { lower: number }) {
                return <GtkScale ref={ref} value={50} lower={lower} upper={100} />;
            }

            await render(<App lower={0} />);
            expect(ref.current?.getAdjustment()?.getLower()).toBe(0);

            await render(<App lower={20} />);
            expect(ref.current?.getAdjustment()?.getLower()).toBe(20);
        });

        it("updates upper bound when prop changes", async () => {
            const ref = createRef<Gtk.Scale>();

            function App({ upper }: { upper: number }) {
                return <GtkScale ref={ref} value={50} lower={0} upper={upper} />;
            }

            await render(<App upper={100} />);
            expect(ref.current?.getAdjustment()?.getUpper()).toBe(100);

            await render(<App upper={200} />);
            expect(ref.current?.getAdjustment()?.getUpper()).toBe(200);
        });

        it("updates step increment when prop changes", async () => {
            const ref = createRef<Gtk.Scale>();

            function App({ stepIncrement }: { stepIncrement: number }) {
                return <GtkScale ref={ref} value={50} lower={0} upper={100} stepIncrement={stepIncrement} />;
            }

            await render(<App stepIncrement={1} />);
            expect(ref.current?.getAdjustment()?.getStepIncrement()).toBe(1);

            await render(<App stepIncrement={5} />);
            expect(ref.current?.getAdjustment()?.getStepIncrement()).toBe(5);
        });

        it("updates page increment when prop changes", async () => {
            const ref = createRef<Gtk.Scale>();

            function App({ pageIncrement }: { pageIncrement: number }) {
                return <GtkScale ref={ref} value={50} lower={0} upper={100} pageIncrement={pageIncrement} />;
            }

            await render(<App pageIncrement={10} />);
            expect(ref.current?.getAdjustment()?.getPageIncrement()).toBe(10);

            await render(<App pageIncrement={25} />);
            expect(ref.current?.getAdjustment()?.getPageIncrement()).toBe(25);
        });

        it("uses default values when not specified", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(<GtkScale ref={ref} />);

            const adjustment = ref.current?.getAdjustment();
            expect(adjustment?.getValue()).toBe(0);
            expect(adjustment?.getLower()).toBe(0);
            expect(adjustment?.getUpper()).toBe(100);
            expect(adjustment?.getStepIncrement()).toBe(1);
            expect(adjustment?.getPageIncrement()).toBe(10);
            expect(adjustment?.getPageSize()).toBe(0);
        });

        it("connects onValueChanged callback", async () => {
            const ref = createRef<Gtk.Scale>();
            const onValueChanged = vi.fn();

            await render(<GtkScale ref={ref} value={50} lower={0} upper={100} onValueChanged={onValueChanged} />);

            const adjustment = ref.current?.getAdjustment();
            expect(adjustment).not.toBeNull();

            adjustment?.setValue(75);

            await waitFor(() => {
                expect(onValueChanged).toHaveBeenCalledWith(75);
            });
        });

        it("updates onValueChanged callback when prop changes", async () => {
            const ref = createRef<Gtk.Scale>();
            const onValueChanged1 = vi.fn();
            const onValueChanged2 = vi.fn();

            function App({ onValueChanged }: { onValueChanged: (value: number) => void }) {
                return <GtkScale ref={ref} value={50} lower={0} upper={100} onValueChanged={onValueChanged} />;
            }

            await render(<App onValueChanged={onValueChanged1} />);
            const adjustment = ref.current?.getAdjustment();
            adjustment?.setValue(60);

            await waitFor(() => {
                expect(onValueChanged1).toHaveBeenCalledWith(60);
            });

            await render(<App onValueChanged={onValueChanged2} />);
            adjustment?.setValue(70);

            await waitFor(() => {
                expect(onValueChanged2).toHaveBeenCalledWith(70);
            });
        });

        it("removes onValueChanged callback when cleared", async () => {
            const ref = createRef<Gtk.Scale>();
            const onValueChanged = vi.fn();

            function App({ hasCallback }: { hasCallback: boolean }) {
                return (
                    <GtkScale
                        ref={ref}
                        value={50}
                        lower={0}
                        upper={100}
                        onValueChanged={hasCallback ? onValueChanged : undefined}
                    />
                );
            }

            await render(<App hasCallback={true} />);
            const adjustment = ref.current?.getAdjustment();
            adjustment?.setValue(60);

            await waitFor(() => {
                expect(onValueChanged).toHaveBeenCalledWith(60);
            });

            const callCount = onValueChanged.mock.calls.length;

            await render(<App hasCallback={false} />);
            adjustment?.setValue(70);

            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(onValueChanged.mock.calls.length).toBe(callCount);
        });

        it("sets all adjustment properties together", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(
                <GtkScale ref={ref} value={25} lower={10} upper={50} stepIncrement={2} pageIncrement={5} pageSize={0} />,
            );

            const adjustment = ref.current?.getAdjustment();
            expect(adjustment?.getValue()).toBe(25);
            expect(adjustment?.getLower()).toBe(10);
            expect(adjustment?.getUpper()).toBe(50);
            expect(adjustment?.getStepIncrement()).toBe(2);
            expect(adjustment?.getPageIncrement()).toBe(5);
            expect(adjustment?.getPageSize()).toBe(0);
        });
    });
});
