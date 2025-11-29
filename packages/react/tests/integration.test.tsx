import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import React, { useState, useEffect, useCallback } from "react";
import * as Gtk from "@gtkx/ffi/gtk";
import { start, stop } from "@gtkx/ffi";
import { reconciler, disposeAllInstances, setCurrentApp } from "../src/reconciler.js";
import { createNode } from "../src/factory.js";
import { WidgetNode } from "../src/nodes/widget.js";
import { DialogNode } from "../src/nodes/dialog.js";
import { ListViewNode, ListItemNode } from "../src/nodes/list.js";
import { DropDownNode, DropDownItemNode } from "../src/nodes/dropdown.js";
import { GridNode, GridChildNode } from "../src/nodes/grid.js";
import { NotebookNode } from "../src/nodes/notebook.js";
import type Reconciler from "react-reconciler";

const APP_ID = "com.gtkx.test.react";

let app: Gtk.Application | null = null;
let container: unknown = null;

const createTestContainer = (): unknown => {
    return (
        reconciler.createContainer as (
            containerInfo: unknown,
            tag: number,
            hydrationCallbacks: unknown,
            isStrictMode: boolean,
            concurrentUpdatesByDefault: boolean,
            identifierPrefix: string,
            onRecoverableError: (error: Error, info: Reconciler.BaseErrorInfo) => void,
            transitionCallbacks: unknown,
            formState: unknown,
            useModernStrictMode: unknown,
            useClient: unknown,
        ) => unknown
    )(
        APP_ID,
        0,
        null,
        false,
        false,
        "",
        (error: Error) => console.error("Test reconciler error:", error),
        null,
        null,
        null,
        null,
    );
};

const renderElement = (element: React.ReactNode): void => {
    reconciler.updateContainer(element, container, null, () => {});
};

const unmountAll = (): void => {
    reconciler.updateContainer(null, container, null, () => {});
    disposeAllInstances();
};

beforeAll(() => {
    app = start(APP_ID);
    setCurrentApp(app);
    container = createTestContainer();
});

afterAll(() => {
    unmountAll();
    stop();
});

afterEach(() => {
    disposeAllInstances();
});

describe("Node Creation and Matching", () => {
    describe("WidgetNode", () => {
        it("should create a WidgetNode for standard widgets", () => {
            const node = createNode("Button", { label: "Test" }, app);
            expect(node).toBeInstanceOf(WidgetNode);
            expect(node.getWidget()).toBeDefined();
        });

        it("should create ApplicationWindow with app reference", () => {
            const node = createNode("ApplicationWindow", { title: "Test Window" }, app);
            expect(node).toBeInstanceOf(WidgetNode);
            const widget = node.getWidget() as Gtk.ApplicationWindow;
            expect(widget).toBeDefined();
        });

        it("should create Box with correct properties", () => {
            const node = createNode("Box", { spacing: 10, orientation: Gtk.Orientation.VERTICAL }, app);
            expect(node).toBeInstanceOf(WidgetNode);
        });

        it("should create Label with text", () => {
            const node = createNode("Label", { label: "Hello World" }, app);
            expect(node).toBeInstanceOf(WidgetNode);
        });
    });

    describe("DialogNode", () => {
        it("should match AboutDialog type", () => {
            const widget = new Gtk.AboutDialog();
            expect(DialogNode.matches("AboutDialog", widget)).toBe(true);
        });

        it("should match Dialog.Root type", () => {
            const widget = new Gtk.AboutDialog();
            expect(DialogNode.matches("AboutDialog.Root", widget)).toBe(true);
        });

        it("should create DialogNode for dialog types", () => {
            const node = createNode("AboutDialog", { programName: "Test App" }, app);
            expect(node).toBeInstanceOf(DialogNode);
        });
    });

    describe("ListViewNode", () => {
        it("should match ListView type", () => {
            const widget = new Gtk.ListView();
            expect(ListViewNode.matches("ListView", widget)).toBe(true);
        });

        it("should match ListView.Root type", () => {
            const widget = new Gtk.ListView();
            expect(ListViewNode.matches("ListView.Root", widget)).toBe(true);
        });

        it("should create ListViewNode with factory", () => {
            const renderItem = () => new Gtk.Label({ label: "Item" });
            const node = createNode("ListView", { renderItem }, app) as ListViewNode;
            expect(node).toBeInstanceOf(ListViewNode);
            expect(node.getWidget()).toBeDefined();
        });
    });

    describe("ListItemNode", () => {
        it("should match ListView.Item type", () => {
            expect(ListItemNode.matches("ListView.Item", null)).toBe(true);
        });

        it("should match ColumnView.Item type", () => {
            expect(ListItemNode.matches("ColumnView.Item", null)).toBe(true);
        });

        it("should match GridView.Item type", () => {
            expect(ListItemNode.matches("GridView.Item", null)).toBe(true);
        });

        it("should not match non-Item types", () => {
            expect(ListItemNode.matches("ListView", null)).toBe(false);
            expect(ListItemNode.matches("Button", null)).toBe(false);
        });
    });

    describe("DropDownNode", () => {
        it("should match DropDown type", () => {
            const widget = new Gtk.DropDown();
            expect(DropDownNode.matches("DropDown", widget)).toBe(true);
        });

        it("should match DropDown.Root type", () => {
            const widget = new Gtk.DropDown();
            expect(DropDownNode.matches("DropDown.Root", widget)).toBe(true);
        });

        it("should create DropDownNode with label function", () => {
            const itemLabel = (item: { name: string }) => item.name;
            const node = createNode("DropDown", { itemLabel }, app) as DropDownNode;
            expect(node).toBeInstanceOf(DropDownNode);
        });
    });

    describe("DropDownItemNode", () => {
        it("should match DropDown.Item type", () => {
            expect(DropDownItemNode.matches("DropDown.Item", null)).toBe(true);
        });

        it("should not match other types", () => {
            expect(DropDownItemNode.matches("DropDown", null)).toBe(false);
            expect(DropDownItemNode.matches("ListView.Item", null)).toBe(false);
        });
    });

    describe("GridNode", () => {
        it("should match Grid type", () => {
            const widget = new Gtk.Grid();
            expect(GridNode.matches("Grid", widget)).toBe(true);
        });

        it("should match Grid.Root type", () => {
            const widget = new Gtk.Grid();
            expect(GridNode.matches("Grid.Root", widget)).toBe(true);
        });
    });

    describe("GridChildNode", () => {
        it("should match Grid.Child type", () => {
            expect(GridChildNode.matches("Grid.Child", null)).toBe(true);
        });

        it("should not match other types", () => {
            expect(GridChildNode.matches("Grid", null)).toBe(false);
        });
    });

    describe("NotebookNode", () => {
        it("should match Notebook type", () => {
            const widget = new Gtk.Notebook();
            expect(NotebookNode.matches("Notebook", widget)).toBe(true);
        });

        it("should match Notebook.Root type", () => {
            const widget = new Gtk.Notebook();
            expect(NotebookNode.matches("Notebook.Root", widget)).toBe(true);
        });
    });
});

describe("Signal Handler Management", () => {
    describe("Widget signal connections", () => {
        it("should connect signal handlers on creation", () => {
            let clicked = false;
            const onClicked = () => { clicked = true; };

            const node = createNode("Button", { label: "Test", onClicked }, app) as WidgetNode;
            const widget = node.getWidget() as Gtk.Button;

            expect(widget).toBeDefined();
        });

        it("should update signal handlers when props change", () => {
            let clickCount = 0;
            const handler1 = () => { clickCount = 1; };
            const handler2 = () => { clickCount = 2; };

            const node = createNode("Button", { label: "Test", onClicked: handler1 }, app) as WidgetNode;
            node.updateProps({ onClicked: handler1 }, { onClicked: handler2 });
        });

        it("should disconnect signal handlers on dispose", () => {
            const onClicked = () => {};

            const node = createNode("Button", { label: "Test", onClicked }, app) as WidgetNode;
            const widget = node.getWidget() as Gtk.Button;

            node.dispose?.();
        });
    });

    describe("Dialog signal connections", () => {
        it("should connect signal handlers to dialogs", () => {
            const onCloseRequest = () => false;

            const node = createNode("AboutDialog", {
                programName: "Test",
                onCloseRequest
            }, app) as DialogNode;

            expect(node.getWidget()).toBeDefined();
        });

        it("should disconnect dialog signals on dispose", () => {
            const onCloseRequest = () => false;

            const node = createNode("AboutDialog", {
                programName: "Test",
                onCloseRequest
            }, app) as DialogNode;

            node.dispose?.();
        });
    });

    describe("ListView signal connections", () => {
        it("should connect factory signals", () => {
            const renderItem = () => new Gtk.Label({ label: "Item" });

            const node = createNode("ListView", { renderItem }, app) as ListViewNode;
            expect(node.getWidget()).toBeDefined();
        });

        it("should disconnect factory signals on dispose", () => {
            const renderItem = () => new Gtk.Label({ label: "Item" });

            const node = createNode("ListView", { renderItem }, app) as ListViewNode;
            node.dispose?.();
        });
    });

    describe("DropDown signal connections", () => {
        it("should connect selection changed signal", () => {
            let selectedItem: unknown = null;
            const onSelectionChanged = (item: unknown) => { selectedItem = item; };
            const itemLabel = (item: string) => item;

            const node = createNode("DropDown", {
                itemLabel,
                onSelectionChanged
            }, app) as DropDownNode;

            expect(node.getWidget()).toBeDefined();
        });

        it("should disconnect selection signal on dispose", () => {
            const onSelectionChanged = () => {};
            const itemLabel = (item: string) => item;

            const node = createNode("DropDown", {
                itemLabel,
                onSelectionChanged
            }, app) as DropDownNode;

            node.dispose?.();
        });
    });
});

describe("App Shutdown and Signal Cleanup", () => {
    it("should dispose all instances when unmounting", () => {
        const onClicked = () => {};

        createNode("Button", { label: "Button 1", onClicked }, app);
        createNode("Button", { label: "Button 2", onClicked }, app);
        createNode("Button", { label: "Button 3", onClicked }, app);

        disposeAllInstances();
    });

    it("should handle rapid mount/unmount cycles", () => {
        for (let i = 0; i < 10; i++) {
            const node = createNode("Button", { label: `Button ${i}` }, app);
            node.dispose?.();
        }
    });

    it("should clean up nested widget hierarchies", () => {
        const boxNode = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 10 }, app);
        const button1 = createNode("Button", { label: "Button 1" }, app);
        const button2 = createNode("Button", { label: "Button 2" }, app);

        boxNode.appendChild(button1);
        boxNode.appendChild(button2);

        boxNode.removeChild(button1);
        boxNode.removeChild(button2);

        button1.dispose?.();
        button2.dispose?.();
        boxNode.dispose?.();
    });
});

describe("Multiple Windows and Dialogs", () => {
    it("should handle multiple ApplicationWindows", () => {
        const window1 = createNode("ApplicationWindow", { title: "Window 1" }, app);
        const window2 = createNode("ApplicationWindow", { title: "Window 2" }, app);

        expect(window1.getWidget()).toBeDefined();
        expect(window2.getWidget()).toBeDefined();

        window1.dispose?.();
        window2.dispose?.();
    });

    it("should handle multiple dialogs", () => {
        const dialog1 = createNode("AboutDialog", { programName: "App 1" }, app);
        const dialog2 = createNode("AboutDialog", { programName: "App 2" }, app);

        expect(dialog1.getWidget()).toBeDefined();
        expect(dialog2.getWidget()).toBeDefined();

        dialog1.dispose?.();
        dialog2.dispose?.();
    });

    it("should clean up dialogs with connected signals", () => {
        const onCloseRequest1 = () => false;
        const onCloseRequest2 = () => false;

        const dialog1 = createNode("AboutDialog", {
            programName: "App 1",
            onCloseRequest: onCloseRequest1
        }, app);
        const dialog2 = createNode("AboutDialog", {
            programName: "App 2",
            onCloseRequest: onCloseRequest2
        }, app);

        dialog1.dispose?.();
        dialog2.dispose?.();
    });

    it("should handle window with child widgets", () => {
        const window = createNode("ApplicationWindow", { title: "Test" }, app);
        const box = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 10 }, app);
        const button = createNode("Button", { label: "Click", onClicked: () => {} }, app);

        window.appendChild(box);
        box.appendChild(button);

        window.removeChild(box);

        button.dispose?.();
        box.dispose?.();
        window.dispose?.();
    });
});

describe("Widget Disposal and Memory Management", () => {
    it("should dispose widgets without errors", () => {
        const nodes = [];
        for (let i = 0; i < 100; i++) {
            nodes.push(createNode("Label", { label: `Label ${i}` }, app));
        }

        for (const node of nodes) {
            node.dispose?.();
        }
    });

    it("should handle disposal of complex widget trees", () => {
        const createTree = (depth: number): ReturnType<typeof createNode> => {
            const box = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 5 }, app);

            if (depth > 0) {
                const child1 = createTree(depth - 1);
                const child2 = createTree(depth - 1);
                box.appendChild(child1);
                box.appendChild(child2);
            } else {
                const label = createNode("Label", { label: "Leaf" }, app);
                box.appendChild(label);
            }

            return box;
        };

        const tree = createTree(4);
        disposeAllInstances();
    });

    it("should handle disposal with signal handlers attached", () => {
        const handlers: Array<() => void> = [];
        const nodes = [];

        for (let i = 0; i < 50; i++) {
            const handler = () => console.log(`Button ${i} clicked`);
            handlers.push(handler);
            nodes.push(createNode("Button", { label: `Button ${i}`, onClicked: handler }, app));
        }

        disposeAllInstances();
    });

    it("should handle ListView with items disposal", () => {
        const renderItem = () => new Gtk.Label({ label: "Item" });
        const listView = createNode("ListView", { renderItem }, app) as ListViewNode;

        for (let i = 0; i < 20; i++) {
            const item = createNode("ListView.Item", { item: { id: i } }, null) as ListItemNode<{ id: number }>;
            listView.appendChild(item);
        }

        listView.dispose?.();
    });

    it("should handle DropDown with items disposal", () => {
        const itemLabel = (item: { name: string }) => item.name;
        const dropdown = createNode("DropDown", { itemLabel }, app) as DropDownNode;

        for (let i = 0; i < 20; i++) {
            const item = createNode("DropDown.Item", { item: { name: `Item ${i}` } }, null) as DropDownItemNode;
            dropdown.appendChild(item);
        }

        dropdown.dispose?.();
    });

    it("should handle Grid with children disposal", () => {
        const grid = createNode("Grid", { rowSpacing: 10, columnSpacing: 10 }, app) as GridNode;

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const child = createNode("Grid.Child", {
                    row,
                    column: col
                }, null) as GridChildNode;
                const button = createNode("Button", { label: `${row},${col}` }, app);
                child.appendChild(button);
                grid.appendChild(child);
            }
        }

        grid.dispose?.();
    });

    it("should handle Notebook with pages disposal", () => {
        const notebook = createNode("Notebook", {}, app) as NotebookNode;

        for (let i = 0; i < 10; i++) {
            const page = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 5 }, app);
            const label = createNode("Label", { label: `Page ${i}` }, app);
            page.appendChild(label);
            notebook.appendChild(page);
        }

        notebook.dispose?.();
    });
});

describe("React Reconciler Integration", () => {
    it("should render a simple component", () => {
        const SimpleComponent = () => (
            <Button label="Hello" />
        );

        renderElement(<SimpleComponent />);
    });

    it("should render nested components", () => {
        const NestedComponent = () => (
            <Box spacing={10}>
                <Label label="Title" />
                <Button label="Click Me" />
            </Box>
        );

        renderElement(<NestedComponent />);
    });

    it("should handle component updates", () => {
        let setCount: React.Dispatch<React.SetStateAction<number>> | null = null;

        const CounterComponent = () => {
            const [count, _setCount] = useState(0);
            setCount = _setCount;
            return <Label label={`Count: ${count}`} />;
        };

        renderElement(<CounterComponent />);

        if (setCount) {
            setCount(5);
        }
    });

    it("should handle conditional rendering", () => {
        let setVisible: React.Dispatch<React.SetStateAction<boolean>> | null = null;

        const ConditionalComponent = () => {
            const [visible, _setVisible] = useState(true);
            setVisible = _setVisible;
            return (
                <Box spacing={10}>
                    {visible && <Label label="Visible" />}
                    <Button label="Toggle" />
                </Box>
            );
        };

        renderElement(<ConditionalComponent />);

        if (setVisible) {
            setVisible(false);
            setVisible(true);
            setVisible(false);
        }
    });

    it("should handle list rendering", () => {
        const items = [1, 2, 3, 4, 5];

        const ListComponent = () => (
            <Box spacing={5}>
                {items.map(item => (
                    <Label key={item} label={`Item ${item}`} />
                ))}
            </Box>
        );

        renderElement(<ListComponent />);
    });

    it("should clean up on unmount without errors", () => {
        const EffectComponent = () => {
            useEffect(() => {
                return () => {};
            }, []);
            return <Label label="Effect Component" />;
        };

        renderElement(<EffectComponent />);
        unmountAll();
    });

    it("should handle signal handlers in React components", () => {
        let clickCount = 0;

        const ClickableComponent = () => {
            const handleClick = useCallback(() => {
                clickCount++;
            }, []);

            return <Button label="Click Me" onClicked={handleClick} />;
        };

        renderElement(<ClickableComponent />);
        unmountAll();
    });

    it("should handle multiple windows in React", () => {
        const MultiWindowApp = () => (
            <>
                <ApplicationWindow title="Window 1">
                    <Label label="Content 1" />
                </ApplicationWindow>
                <ApplicationWindow title="Window 2">
                    <Label label="Content 2" />
                </ApplicationWindow>
            </>
        );

        renderElement(<MultiWindowApp />);
        unmountAll();
    });

    it("should handle dialogs in React", () => {
        const DialogApp = () => (
            <ApplicationWindow title="Main">
                <Box spacing={10}>
                    <Label label="Main Window" />
                </Box>
            </ApplicationWindow>
        );

        renderElement(<DialogApp />);
        unmountAll();
    });
});

describe("Edge Cases", () => {
    it("should handle empty children", () => {
        const node = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 10 }, app);
        expect(node.getWidget()).toBeDefined();
    });

    it("should handle null/undefined props", () => {
        const node = createNode("Button", { label: undefined }, app);
        expect(node.getWidget()).toBeDefined();
    });

    it("should handle rapid prop updates", () => {
        const node = createNode("Button", { label: "Initial" }, app);

        for (let i = 0; i < 100; i++) {
            node.updateProps({ label: `Label ${i - 1}` }, { label: `Label ${i}` });
        }
    });

    it("should handle adding and removing same child", () => {
        const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 10 }, app);
        const child = createNode("Label", { label: "Test" }, app);

        for (let i = 0; i < 10; i++) {
            parent.appendChild(child);
            parent.removeChild(child);
        }
    });

    it("should handle disposing already disposed node", () => {
        const node = createNode("Button", { label: "Test" }, app);
        node.dispose?.();
        node.dispose?.();
    });
});

declare global {
    namespace JSX {
        interface IntrinsicElements {
            Button: { label?: string; onClicked?: () => void };
            Label: { label?: string };
            Box: { spacing?: number; children?: React.ReactNode };
            ApplicationWindow: { title?: string; children?: React.ReactNode };
        }
    }
}
