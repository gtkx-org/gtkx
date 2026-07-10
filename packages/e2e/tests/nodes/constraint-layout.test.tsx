import { ConstraintLayout } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, within } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import {
    collectConstraints,
    collectGuides,
    firstConstraint,
    layoutFrom,
    NamedButton,
    NamedLabel,
    onlyConstraint,
    renderConstraintBox,
} from "../helpers/constraint-layout-cases.js";

const A = Gtk.ConstraintAttribute;
const R = Gtk.ConstraintRelation;
const S = Gtk.ConstraintStrength;

const requireWidget = <T,>(ref: RefObject<T | null>): T => {
    const widget = ref.current;
    if (!widget) throw new Error("expected widget");
    return widget;
};

describe("render - GtkConstraintLayout attach", () => {
    it("attaches a ConstraintLayout to the host widget", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(<GtkBox ref={boxRef} layoutManager={<ConstraintLayout />} />);

        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("accepts an empty <ConstraintLayout> without errors", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(<GtkBox ref={boxRef} layoutManager={<ConstraintLayout />} />);

        const layout = layoutFrom(boxRef);
        expect(collectConstraints(layout)).toHaveLength(0);
        expect(collectGuides(layout)).toHaveLength(0);
    });
});

describe("render - name-based target resolution (a)", () => {
    it("resolves named children so Constraints can reference them", async () => {
        const boxRef = createRef<Gtk.Box>();

        await renderConstraintBox(
            boxRef,
            <ConstraintLayout.Constraint target="a" targetAttribute={A.WIDTH} source="b" sourceAttribute={A.WIDTH} />,
            <>
                <NamedLabel id="a" label="A" />
                <NamedLabel id="b" label="B" />
            </>,
        );

        const c = onlyConstraint(boxRef);
        expect(c.getTarget()).toBe(screen.getByName("a"));
        expect(c.getSource()).toBe(screen.getByName("b"));
        expect(c.getTargetAttribute()).toBe(A.WIDTH);
        expect(c.getSourceAttribute()).toBe(A.WIDTH);
    });
});

describe("render - name-based target resolution (b)", () => {
    it("renders a named child as a direct child of the host widget", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef} layoutManager={<ConstraintLayout />}>
                <NamedLabel id="a" label="Inside" />
            </GtkBox>,
        );

        expect(within(requireWidget(boxRef)).getByName("a")).toBeTruthy();
    });

    it("ignores an unnamed child rather than matching its widget type name", async () => {
        await expect(
            render(
                <GtkBox
                    layoutManager={
                        <ConstraintLayout>
                            <ConstraintLayout.Constraint target="GtkButton" targetAttribute={A.WIDTH} constant={100} />
                        </ConstraintLayout>
                    }
                >
                    <GtkButton label="unnamed" />
                    <GtkButton name="named" label="named" />
                </GtkBox>,
            ),
        ).rejects.toThrow(/unknown id 'GtkButton'/);
    });

    it("scopes resolution to each layout's own children", async () => {
        const firstRef = createRef<Gtk.Box>();
        const secondRef = createRef<Gtk.Box>();

        await render(
            <GtkBox>
                <GtkBox
                    ref={firstRef}
                    layoutManager={
                        <ConstraintLayout>
                            <ConstraintLayout.Constraint
                                target="a"
                                targetAttribute={A.START}
                                sourceAttribute={A.START}
                                constant={1}
                            />
                        </ConstraintLayout>
                    }
                >
                    <GtkLabel name="a" label="first" />
                </GtkBox>
                <GtkBox
                    ref={secondRef}
                    layoutManager={
                        <ConstraintLayout>
                            <ConstraintLayout.Constraint
                                target="a"
                                targetAttribute={A.START}
                                sourceAttribute={A.START}
                                constant={2}
                            />
                        </ConstraintLayout>
                    }
                >
                    <GtkLabel name="a" label="second" />
                </GtkBox>
            </GtkBox>,
        );

        expect(firstConstraint(firstRef).getTarget()).toBe(within(requireWidget(firstRef)).getByName("a"));
        expect(firstConstraint(secondRef).getTarget()).toBe(within(requireWidget(secondRef)).getByName("a"));
    });

    it("treats `super` (or omitted source) as the layout-owning widget", async () => {
        const boxRef = createRef<Gtk.Box>();

        await renderConstraintBox(
            boxRef,
            <ConstraintLayout.Constraint target="a" targetAttribute={A.START} sourceAttribute={A.START} constant={8} />,
            <NamedLabel id="a" label="A" />,
        );

        const c = onlyConstraint(boxRef);
        expect(c.getTarget()).toBe(screen.getByName("a"));
        expect(c.getSource()).toBeNull();
        expect(c.getConstant()).toBe(8);
    });

    it("treats `super` as the host even when a child is named `super`", async () => {
        const boxRef = createRef<Gtk.Box>();

        await renderConstraintBox(
            boxRef,
            <ConstraintLayout.Constraint
                target="a"
                targetAttribute={A.START}
                source="super"
                sourceAttribute={A.START}
            />,
            <>
                <NamedLabel id="a" label="A" />
                <GtkLabel name="super" label="Super" />
            </>,
        );

        const c = onlyConstraint(boxRef);
        expect(c.getSource()).toBeNull();
        expect(c.getSource()).not.toBe(screen.getByName("super"));
    });

    it("throws a clear error when a Constraint references an unknown id", async () => {
        await expect(
            render(
                <GtkBox
                    layoutManager={
                        <ConstraintLayout>
                            <ConstraintLayout.Constraint target="ghost" targetAttribute={A.WIDTH} constant={100} />
                        </ConstraintLayout>
                    }
                />,
            ),
        ).rejects.toThrow(/unknown id 'ghost'/);
    });
});

describe("render - GtkConstraintLayout.Guide (construction)", () => {
    it("adds a guide with size and strength props", async () => {
        const boxRef = createRef<Gtk.Box>();

        await renderConstraintBox(
            boxRef,
            <ConstraintLayout.Guide
                id="space"
                minWidth={10}
                minHeight={10}
                natWidth={100}
                natHeight={20}
                maxWidth={200}
                maxHeight={30}
                strength={S.STRONG}
            />,
        );

        const layout = layoutFrom(boxRef);
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
    it("lets a Constraint reference a Guide by id", async () => {
        const boxRef = createRef<Gtk.Box>();

        await renderConstraintBox(
            boxRef,
            <>
                <ConstraintLayout.Guide id="divider" minWidth={0} natWidth={0} maxWidth={0} />
                <ConstraintLayout.Constraint
                    target="a"
                    targetAttribute={A.END}
                    source="divider"
                    sourceAttribute={A.START}
                />
            </>,
            <NamedLabel id="a" label="A" />,
        );

        const guide = collectGuides(layoutFrom(boxRef))[0];
        const c = firstConstraint(boxRef);
        expect(c.getSource()).toBe(guide);
        expect(c.getTarget()).toBe(screen.getByName("a"));
    });

    it("removes the guide from the layout when unmounted", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ show }: { show: boolean }) {
            return (
                <GtkBox
                    ref={boxRef}
                    layoutManager={<ConstraintLayout>{show && <ConstraintLayout.Guide id="g" />}</ConstraintLayout>}
                />
            );
        }

        const { rerender } = await render(<App show={true} />);
        let layout = layoutFrom(boxRef);
        expect(collectGuides(layout)).toHaveLength(1);

        await rerender(<App show={false} />);
        layout = layoutFrom(boxRef);
        expect(collectGuides(layout)).toHaveLength(0);
    });
});

describe("render - GtkConstraintLayout.Constraint updates", () => {
    it("recreates the constraint when a prop changes (constant value)", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ constant }: { constant: number }) {
            return (
                <GtkBox
                    ref={boxRef}
                    layoutManager={
                        <ConstraintLayout>
                            <ConstraintLayout.Constraint
                                target="a"
                                targetAttribute={A.LEFT}
                                sourceAttribute={A.LEFT}
                                constant={constant}
                            />
                        </ConstraintLayout>
                    }
                >
                    <NamedButton id="a" label="A" />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App constant={10} />);
        let layout = layoutFrom(boxRef);
        let constraints = collectConstraints(layout);
        expect(constraints).toHaveLength(1);
        expect((constraints[0] as Gtk.Constraint).getConstant()).toBe(10);

        await rerender(<App constant={50} />);
        layout = layoutFrom(boxRef);
        constraints = collectConstraints(layout);
        expect(constraints).toHaveLength(1);
        expect((constraints[0] as Gtk.Constraint).getConstant()).toBe(50);
    });
});

describe("render - GtkConstraintLayout.Constraint removal", () => {
    it("removes the constraint when the named widget is unmounted", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ show }: { show: boolean }) {
            return (
                <GtkBox
                    ref={boxRef}
                    layoutManager={
                        <ConstraintLayout>
                            {show && (
                                <ConstraintLayout.Constraint
                                    target="a"
                                    targetAttribute={A.LEFT}
                                    sourceAttribute={A.LEFT}
                                    constant={5}
                                />
                            )}
                        </ConstraintLayout>
                    }
                >
                    <NamedButton id="a" label="A" />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App show={true} />);
        let layout = layoutFrom(boxRef);
        expect(collectConstraints(layout)).toHaveLength(1);

        await rerender(<App show={false} />);
        layout = layoutFrom(boxRef);
        expect(collectConstraints(layout)).toHaveLength(0);
    });
});

describe("render - GtkConstraintLayout.Constraint props", () => {
    it("forwards the relation prop to the underlying Gtk.Constraint", async () => {
        const boxRef = createRef<Gtk.Box>();

        await renderConstraintBox(
            boxRef,
            <ConstraintLayout.Constraint
                target="a"
                targetAttribute={A.WIDTH}
                relation={R.LE}
                sourceAttribute={A.NONE}
                constant={200}
            />,
            <NamedButton id="a" label="A" />,
        );

        const c = firstConstraint(boxRef);
        expect(c.getRelation()).toBe(R.LE);
        expect(c.getConstant()).toBe(200);
    });

    it("forwards the strength prop to the underlying Gtk.Constraint", async () => {
        const boxRef = createRef<Gtk.Box>();

        await renderConstraintBox(
            boxRef,
            <ConstraintLayout.Constraint
                target="a"
                targetAttribute={A.LEFT}
                sourceAttribute={A.LEFT}
                constant={4}
                strength={S.STRONG}
            />,
            <NamedButton id="a" label="A" />,
        );

        const c = firstConstraint(boxRef);
        expect(c.getStrength()).toBe(S.STRONG);
    });
});

describe("render - name-based target lifecycle", () => {
    it("follows the widget when its name changes", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ id }: { id: string }) {
            return (
                <GtkBox
                    ref={boxRef}
                    layoutManager={
                        <ConstraintLayout>
                            <ConstraintLayout.Constraint
                                target={id}
                                targetAttribute={A.LEFT}
                                sourceAttribute={A.LEFT}
                                constant={1}
                            />
                        </ConstraintLayout>
                    }
                >
                    <NamedLabel id={id} label="L" />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App id="first" />);
        expect(firstConstraint(boxRef).getTarget()).toBe(screen.getByName("first"));

        await rerender(<App id="second" />);
        expect(firstConstraint(boxRef).getTarget()).toBe(screen.getByName("second"));
    });

    it("unmounts the wrapper cleanly when conditionally removed", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ show }: { show: boolean }) {
            return (
                <GtkBox ref={boxRef} layoutManager={<ConstraintLayout />}>
                    <NamedLabel id="persist" label="P" />
                    {show && <NamedLabel id="cond" label="C" />}
                </GtkBox>
            );
        }

        const { rerender } = await render(<App show={true} />);
        expect(within(requireWidget(boxRef)).getByName("persist")).toBeTruthy();
        expect(within(requireWidget(boxRef)).getByName("cond")).toBeTruthy();

        await rerender(<App show={false} />);
        expect(within(requireWidget(boxRef)).getByName("persist")).toBeTruthy();
        expect(within(requireWidget(boxRef)).queryByName("cond")).toBeNull();
    });

    it("renders a named child without error when its host has no ConstraintLayout", async () => {
        await render(
            <GtkBox>
                <GtkLabel name="orphan" label="Orphan" />
            </GtkBox>,
        );

        expect(screen.getByName("orphan")).toBeTruthy();
    });
});

describe("render - GtkConstraintLayout.Vfl", () => {
    it("parses VFL and adds the resulting constraints", async () => {
        const boxRef = createRef<Gtk.Box>();

        await renderConstraintBox(
            boxRef,
            <ConstraintLayout.Vfl
                lines={["H:|-[a(==b)]-12-[b]-|", "V:|-[a]-|", "V:|-[b]-|"]}
                hspacing={8}
                vspacing={8}
            />,
            <>
                <NamedButton id="a" label="A" />
                <NamedButton id="b" label="B" />
            </>,
        );

        const layout = layoutFrom(boxRef);
        const constraints = collectConstraints(layout);
        expect(constraints.length).toBeGreaterThanOrEqual(5);
    });

    it("builds the views map from named children and guides", async () => {
        const boxRef = createRef<Gtk.Box>();

        await renderConstraintBox(
            boxRef,
            <>
                <ConstraintLayout.Guide id="g" minWidth={20} natWidth={20} maxWidth={20} />
                <ConstraintLayout.Vfl lines={["H:|-[a]-[g]-[b]-|", "V:|-[a]-|", "V:|-[b]-|"]} hspacing={8} />
            </>,
            <>
                <NamedButton id="a" label="A" />
                <NamedButton id="b" label="B" />
            </>,
        );

        const layout = layoutFrom(boxRef);
        expect(collectConstraints(layout).length).toBeGreaterThanOrEqual(5);
    });

    it("re-parses VFL when the lines prop changes", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ lines }: { lines: string[] }) {
            return (
                <GtkBox
                    ref={boxRef}
                    layoutManager={
                        <ConstraintLayout>
                            <ConstraintLayout.Vfl lines={lines} />
                        </ConstraintLayout>
                    }
                >
                    <NamedButton id="a" label="A" />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App lines={["H:|-[a]-|"]} />);
        let layout = layoutFrom(boxRef);
        const initialCount = collectConstraints(layout).length;
        expect(initialCount).toBeGreaterThan(0);

        await rerender(<App lines={["H:|-[a]-|", "V:|-[a]-|"]} />);
        layout = layoutFrom(boxRef);
        const updatedCount = collectConstraints(layout).length;
        expect(updatedCount).toBeGreaterThan(initialCount);
    });

    it("rejects when the VFL description references an unknown view", async () => {
        await expect(
            render(
                <GtkBox
                    layoutManager={
                        <ConstraintLayout>
                            <ConstraintLayout.Vfl lines={["H:|-[ghost]-|"]} />
                        </ConstraintLayout>
                    }
                >
                    <NamedButton id="a" label="A" />
                </GtkBox>,
            ),
        ).rejects.toThrow();
    });
});
