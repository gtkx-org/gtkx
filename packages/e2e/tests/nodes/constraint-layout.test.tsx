import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkConstraintLayout, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const A = Gtk.ConstraintAttribute;
const R = Gtk.ConstraintRelation;
const S = Gtk.ConstraintStrength;

function collectConstraints(layout: Gtk.ConstraintLayout): Gtk.Constraint[] {
    const observer = layout.observeConstraints();
    const out: Gtk.Constraint[] = [];
    for (let i = 0; i < observer.getNItems(); i++) {
        const item = observer.getItem(i);
        if (item instanceof Gtk.Constraint) out.push(item);
    }
    return out;
}

function collectGuides(layout: Gtk.ConstraintLayout): Gtk.ConstraintGuide[] {
    const observer = layout.observeGuides();
    const out: Gtk.ConstraintGuide[] = [];
    for (let i = 0; i < observer.getNItems(); i++) {
        const item = observer.getItem(i);
        if (item instanceof Gtk.ConstraintGuide) out.push(item);
    }
    return out;
}

describe("render - GtkConstraintLayout attach", () => {
    it("attaches a ConstraintLayout to the host widget", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout />
            </GtkBox>,
        );

        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("accepts an empty <GtkConstraintLayout> without errors", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout />
            </GtkBox>,
        );

        const layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        expect(collectConstraints(layout)).toHaveLength(0);
        expect(collectGuides(layout)).toHaveLength(0);
    });
});

describe("render - GtkConstraintLayout.Widget registration (a)", () => {
    it("registers wrapped widgets so Constraint markers can resolve them", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelARef = createRef<Gtk.Label>();
        const labelBRef = createRef<Gtk.Label>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Constraint
                        target="a"
                        targetAttribute={A.WIDTH}
                        source="b"
                        sourceAttribute={A.WIDTH}
                    />
                </GtkConstraintLayout>
                <GtkConstraintLayout.Widget id="a">
                    <GtkLabel ref={labelARef} label="A" />
                </GtkConstraintLayout.Widget>
                <GtkConstraintLayout.Widget id="b">
                    <GtkLabel ref={labelBRef} label="B" />
                </GtkConstraintLayout.Widget>
            </GtkBox>,
        );

        const layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        const constraints = collectConstraints(layout);
        expect(constraints).toHaveLength(1);
        const c = constraints[0] as Gtk.Constraint;
        expect(c.getTarget()).toBe(labelARef.current);
        expect(c.getSource()).toBe(labelBRef.current);
        expect(c.getTargetAttribute()).toBe(A.WIDTH);
        expect(c.getSourceAttribute()).toBe(A.WIDTH);
    });
});

describe("render - GtkConstraintLayout.Widget registration (b)", () => {
    it("attaches the wrapped widget to the host widget (transparent in the GTK tree)", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout />
                <GtkConstraintLayout.Widget id="a">
                    <GtkLabel ref={labelRef} label="Inside" />
                </GtkConstraintLayout.Widget>
            </GtkBox>,
        );

        expect(labelRef.current?.getParent()).toBe(boxRef.current);
    });

    it("treats `super` (or omitted source) as the layout-owning widget", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Constraint
                        target="a"
                        targetAttribute={A.START}
                        sourceAttribute={A.START}
                        constant={8}
                    />
                </GtkConstraintLayout>
                <GtkConstraintLayout.Widget id="a">
                    <GtkLabel ref={labelRef} label="A" />
                </GtkConstraintLayout.Widget>
            </GtkBox>,
        );

        const layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        const constraints = collectConstraints(layout);
        expect(constraints).toHaveLength(1);
        const c = constraints[0] as Gtk.Constraint;
        expect(c.getTarget()).toBe(labelRef.current);
        expect(c.getSource()).toBeNull();
        expect(c.getConstant()).toBe(8);
    });

    it("throws a clear error when a Constraint references an unknown id", async () => {
        await expect(
            render(
                <GtkBox>
                    <GtkConstraintLayout>
                        <GtkConstraintLayout.Constraint target="ghost" targetAttribute={A.WIDTH} constant={100} />
                    </GtkConstraintLayout>
                </GtkBox>,
            ),
        ).rejects.toThrow(/unknown id 'ghost'/);
    });
});

describe("render - GtkConstraintLayout.Guide (construction)", () => {
    it("adds a guide with size and strength props", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Guide
                        id="space"
                        minWidth={10}
                        minHeight={10}
                        natWidth={100}
                        natHeight={20}
                        maxWidth={200}
                        maxHeight={30}
                        strength={S.STRONG}
                    />
                </GtkConstraintLayout>
            </GtkBox>,
        );

        const layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        const guides = collectGuides(layout);
        expect(guides).toHaveLength(1);
        const guide = guides[0] as Gtk.ConstraintGuide;
        expect(guide.getName()).toBe("space");
        const [minW, minH] = guide.getMinSize();
        const [natW, natH] = guide.getNatSize();
        const [maxW, maxH] = guide.getMaxSize();
        expect(minW).toBe(10);
        expect(minH).toBe(10);
        expect(natW).toBe(100);
        expect(natH).toBe(20);
        expect(maxW).toBe(200);
        expect(maxH).toBe(30);
        expect(guide.getStrength()).toBe(S.STRONG);
    });
});

describe("render - GtkConstraintLayout.Guide (references)", () => {
    it("lets Constraint markers reference a Guide by id", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Guide id="divider" minWidth={0} natWidth={0} maxWidth={0} />
                    <GtkConstraintLayout.Constraint
                        target="a"
                        targetAttribute={A.END}
                        source="divider"
                        sourceAttribute={A.START}
                    />
                </GtkConstraintLayout>
                <GtkConstraintLayout.Widget id="a">
                    <GtkLabel ref={labelRef} label="A" />
                </GtkConstraintLayout.Widget>
            </GtkBox>,
        );

        const layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        const guides = collectGuides(layout);
        const guide = guides[0];
        const constraints = collectConstraints(layout);
        const c = constraints[0] as Gtk.Constraint;
        expect(c.getSource()).toBe(guide);
        expect(c.getTarget()).toBe(labelRef.current);
    });

    it("removes the guide from the layout when unmounted", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ show }: { show: boolean }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout>{show && <GtkConstraintLayout.Guide id="g" />}</GtkConstraintLayout>
                </GtkBox>
            );
        }

        const { rerender } = await render(<App show={true} />);
        let layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        expect(collectGuides(layout)).toHaveLength(1);

        await rerender(<App show={false} />);
        layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        expect(collectGuides(layout)).toHaveLength(0);
    });
});

describe("render - GtkConstraintLayout.Constraint updates", () => {
    it("recreates the constraint when a prop changes (constant value)", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ constant }: { constant: number }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout>
                        <GtkConstraintLayout.Constraint
                            target="a"
                            targetAttribute={A.LEFT}
                            sourceAttribute={A.LEFT}
                            constant={constant}
                        />
                    </GtkConstraintLayout>
                    <GtkConstraintLayout.Widget id="a">
                        <GtkButton label="A" />
                    </GtkConstraintLayout.Widget>
                </GtkBox>
            );
        }

        const { rerender } = await render(<App constant={10} />);
        let layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        let constraints = collectConstraints(layout);
        expect(constraints).toHaveLength(1);
        expect((constraints[0] as Gtk.Constraint).getConstant()).toBe(10);

        await rerender(<App constant={50} />);
        layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        constraints = collectConstraints(layout);
        expect(constraints).toHaveLength(1);
        expect((constraints[0] as Gtk.Constraint).getConstant()).toBe(50);
    });

    it("removes the constraint when the marker is unmounted", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ show }: { show: boolean }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout>
                        {show && (
                            <GtkConstraintLayout.Constraint
                                target="a"
                                targetAttribute={A.LEFT}
                                sourceAttribute={A.LEFT}
                                constant={5}
                            />
                        )}
                    </GtkConstraintLayout>
                    <GtkConstraintLayout.Widget id="a">
                        <GtkButton label="A" />
                    </GtkConstraintLayout.Widget>
                </GtkBox>
            );
        }

        const { rerender } = await render(<App show={true} />);
        let layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        expect(collectConstraints(layout)).toHaveLength(1);

        await rerender(<App show={false} />);
        layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        expect(collectConstraints(layout)).toHaveLength(0);
    });
});

describe("render - GtkConstraintLayout.Constraint props", () => {
    it("forwards the relation prop to the underlying Gtk.Constraint", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Constraint
                        target="a"
                        targetAttribute={A.WIDTH}
                        relation={R.LE}
                        sourceAttribute={A.NONE}
                        constant={200}
                    />
                </GtkConstraintLayout>
                <GtkConstraintLayout.Widget id="a">
                    <GtkButton label="A" />
                </GtkConstraintLayout.Widget>
            </GtkBox>,
        );

        const layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        const c = collectConstraints(layout)[0] as Gtk.Constraint;
        expect(c.getRelation()).toBe(R.LE);
        expect(c.getConstant()).toBe(200);
    });

    it("forwards the strength prop to the underlying Gtk.Constraint", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Constraint
                        target="a"
                        targetAttribute={A.LEFT}
                        sourceAttribute={A.LEFT}
                        constant={4}
                        strength={S.STRONG}
                    />
                </GtkConstraintLayout>
                <GtkConstraintLayout.Widget id="a">
                    <GtkButton label="A" />
                </GtkConstraintLayout.Widget>
            </GtkBox>,
        );

        const layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        const c = collectConstraints(layout)[0] as Gtk.Constraint;
        expect(c.getStrength()).toBe(S.STRONG);
    });
});

describe("render - GtkConstraintLayout.Widget lifecycle", () => {
    it("re-registers when the id prop changes", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelRef = createRef<Gtk.Label>();

        function App({ id }: { id: string }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout>
                        <GtkConstraintLayout.Constraint
                            target={id}
                            targetAttribute={A.LEFT}
                            sourceAttribute={A.LEFT}
                            constant={1}
                        />
                    </GtkConstraintLayout>
                    <GtkConstraintLayout.Widget id={id}>
                        <GtkLabel ref={labelRef} label="L" />
                    </GtkConstraintLayout.Widget>
                </GtkBox>
            );
        }

        const { rerender } = await render(<App id="first" />);
        let layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        let c = collectConstraints(layout)[0] as Gtk.Constraint;
        expect(c.getTarget()).toBe(labelRef.current);

        await rerender(<App id="second" />);
        layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        c = collectConstraints(layout)[0] as Gtk.Constraint;
        expect(c.getTarget()).toBe(labelRef.current);
    });

    it("unmounts the wrapper cleanly when conditionally removed", async () => {
        const boxRef = createRef<Gtk.Box>();
        const persistRef = createRef<Gtk.Label>();
        const conditionalRef = createRef<Gtk.Label>();

        function App({ show }: { show: boolean }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout />
                    <GtkConstraintLayout.Widget id="persist">
                        <GtkLabel ref={persistRef} label="P" />
                    </GtkConstraintLayout.Widget>
                    {show && (
                        <GtkConstraintLayout.Widget id="cond">
                            <GtkLabel ref={conditionalRef} label="C" />
                        </GtkConstraintLayout.Widget>
                    )}
                </GtkBox>
            );
        }

        const { rerender } = await render(<App show={true} />);
        expect(persistRef.current?.getParent()).toBe(boxRef.current);
        expect(conditionalRef.current?.getParent()).toBe(boxRef.current);

        await rerender(<App show={false} />);
        expect(persistRef.current?.getParent()).toBe(boxRef.current);
        expect(conditionalRef.current).toBeNull();
    });

    it("throws when a Widget has no sibling ConstraintLayout", async () => {
        await expect(
            render(
                <GtkBox>
                    <GtkConstraintLayout.Widget id="orphan">
                        <GtkLabel label="Orphan" />
                    </GtkConstraintLayout.Widget>
                </GtkBox>,
            ),
        ).rejects.toThrow(/must be a sibling of <GtkConstraintLayout>/);
    });
});

describe("render - GtkConstraintLayout.Vfl", () => {
    it("parses VFL and adds the resulting constraints", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkConstraintLayout>
                    <GtkConstraintLayout.Vfl
                        lines={["H:|-[a(==b)]-12-[b]-|", "V:|-[a]-|", "V:|-[b]-|"]}
                        hspacing={8}
                        vspacing={8}
                    />
                </GtkConstraintLayout>
                <GtkConstraintLayout.Widget id="a">
                    <GtkButton label="A" />
                </GtkConstraintLayout.Widget>
                <GtkConstraintLayout.Widget id="b">
                    <GtkButton label="B" />
                </GtkConstraintLayout.Widget>
            </GtkBox>,
        );

        const layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        const constraints = collectConstraints(layout);
        expect(constraints.length).toBeGreaterThanOrEqual(5);
    });

    it("re-parses VFL when the lines prop changes", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ lines }: { lines: string[] }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkConstraintLayout>
                        <GtkConstraintLayout.Vfl lines={lines} />
                    </GtkConstraintLayout>
                    <GtkConstraintLayout.Widget id="a">
                        <GtkButton label="A" />
                    </GtkConstraintLayout.Widget>
                </GtkBox>
            );
        }

        const { rerender } = await render(<App lines={["H:|-[a]-|"]} />);
        let layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        const initialCount = collectConstraints(layout).length;
        expect(initialCount).toBeGreaterThan(0);

        await rerender(<App lines={["H:|-[a]-|", "V:|-[a]-|"]} />);
        layout = boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;
        const updatedCount = collectConstraints(layout).length;
        expect(updatedCount).toBeGreaterThan(initialCount);
    });
});
