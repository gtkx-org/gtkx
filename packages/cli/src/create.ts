import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export type TestingFramework = "vitest" | "jest" | "node" | "none";

export type CreateOptions = {
    name?: string;
    appId?: string;
    packageManager?: PackageManager;
    testing?: TestingFramework;
    claudeSkills?: boolean;
};

const DEPENDENCIES = ["@gtkx/css", "@gtkx/ffi", "@gtkx/react", "react"];

const DEV_DEPENDENCIES = ["@gtkx/cli", "@types/react", "typescript"];

const TESTING_DEV_DEPENDENCIES: Record<Exclude<TestingFramework, "none">, string[]> = {
    vitest: ["@gtkx/testing", "vitest"],
    jest: ["@gtkx/testing", "jest", "@types/jest", "ts-jest"],
    node: ["@gtkx/testing", "@types/node"],
};

export const getTestScript = (testing: TestingFramework): string | undefined => {
    const env = "GDK_BACKEND=x11 GSK_RENDERER=cairo LIBGL_ALWAYS_SOFTWARE=1";

    switch (testing) {
        case "vitest":
            return `${env} xvfb-run -a vitest`;
        case "jest":
            return `${env} xvfb-run -a jest`;
        case "node":
            return `${env} xvfb-run -a node --import tsx --test tests/**/*.test.ts`;
        case "none":
    }
};

export const generatePackageJson = (name: string, appId: string, testing: TestingFramework): string => {
    const testScript = getTestScript(testing);
    const scripts: Record<string, string> = {
        dev: "gtkx dev src/dev.tsx",
        build: "tsc -b",
        start: "node dist/index.js",
    };

    if (testScript) {
        scripts.test = testScript;
    }

    return JSON.stringify(
        {
            name,
            version: "0.0.1",
            private: true,
            type: "module",
            scripts,
            gtkx: {
                appId,
            },
        },
        null,
        4,
    );
};

export const generateTsConfig = (): string => {
    return JSON.stringify(
        {
            compilerOptions: {
                target: "ESNext",
                module: "NodeNext",
                moduleResolution: "NodeNext",
                jsx: "react-jsx",
                strict: true,
                skipLibCheck: true,
                resolveJsonModule: true,
                outDir: "dist",
                rootDir: "src",
            },
            include: ["src/**/*"],
        },
        null,
        4,
    );
};

const generateAppTsx = (name: string): string => {
    const title = name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    return `import { useState } from "react";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, GtkBox, GtkButton, GtkLabel, quit } from "@gtkx/react";

export default function App() {
    const [count, setCount] = useState(0);

    return (
        <GtkApplicationWindow title="${title}" defaultWidth={400} defaultHeight={300} onCloseRequest={quit}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginTop={40} marginStart={40} marginEnd={40}>
                <GtkLabel label="Welcome to GTKX!" />
                <GtkLabel label={\`Count: \${count}\`} />
                <GtkButton label="Increment" onClicked={() => setCount((c) => c + 1)} />
            </GtkBox>
        </GtkApplicationWindow>
    );
}
`;
};

const generateDevTsx = (): string => {
    return `import pkg from "../package.json" with { type: "json" };

export { default } from "./app.js";

export const appId = pkg.gtkx.appId;
`;
};

const generateIndexTsx = (appId: string): string => {
    return `import { render } from "@gtkx/react";
import App from "./app.js";

render(<App />, "${appId}");
`;
};

const generateGitignore = (): string => {
    return `node_modules/
dist/
*.log
.DS_Store
`;
};

const generateSkillMd = (): string => {
    return `---
name: developing-gtkx-apps
description: Build GTK4 desktop applications with GTKX React framework. Use when creating GTKX components, working with GTK widgets, handling signals, or building Linux desktop UIs with React.
---

# Developing GTKX Applications

GTKX is a React framework for building native GTK4 desktop applications on Linux. It uses a custom React reconciler to render React components as native GTK widgets.

## Quick Start

\`\`\`tsx
import { GtkApplicationWindow, GtkBox, GtkButton, GtkLabel, render, quit } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

const App = () => (
    <GtkApplicationWindow title="My App" defaultWidth={800} defaultHeight={600} onCloseRequest={quit}>
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkLabel label="Hello, GTKX!" />
            <GtkButton label="Quit" onClicked={quit} />
        </GtkBox>
    </GtkApplicationWindow>
);

render(<App />, "com.example.myapp");
\`\`\`

## Widget Patterns

### Container Widgets

**GtkBox** - Linear layout:
\`\`\`tsx
<GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
    <GtkLabel label="First" />
    <GtkLabel label="Second" />
</GtkBox>
\`\`\`

**GtkGrid** - 2D positioning:
\`\`\`tsx
<GtkGrid rowSpacing={10} columnSpacing={10}>
    <GridChild column={0} row={0}>
        <GtkLabel label="Top-left" />
    </GridChild>
    <GridChild column={1} row={0} columnSpan={2}>
        <GtkLabel label="Spans 2 columns" />
    </GridChild>
</GtkGrid>
\`\`\`

**GtkStack** - Page-based container:
\`\`\`tsx
<GtkStack visibleChildName="page1">
    <StackPage name="page1" title="Page 1">
        <GtkLabel label="Content 1" />
    </StackPage>
    <StackPage name="page2" title="Page 2">
        <GtkLabel label="Content 2" />
    </StackPage>
</GtkStack>
\`\`\`

**GtkNotebook** - Tabbed container:
\`\`\`tsx
<GtkNotebook>
    <NotebookPage label="Tab 1">
        <Content1 />
    </NotebookPage>
    <NotebookPage label="Tab 2">
        <Content2 />
    </NotebookPage>
</GtkNotebook>
\`\`\`

**GtkPaned** - Resizable split:
\`\`\`tsx
<GtkPaned orientation={Gtk.Orientation.HORIZONTAL} position={280}>
    <Slot for={GtkPaned} id="startChild">
        <SideBar />
    </Slot>
    <Slot for={GtkPaned} id="endChild">
        <MainContent />
    </Slot>
</GtkPaned>
\`\`\`

### Virtual Scrolling Lists

**ListView** - High-performance scrollable list with selection:
\`\`\`tsx
<ListView<Item>
    vexpand
    selected={[selectedId]}
    selectionMode={Gtk.SelectionMode.SINGLE}
    onSelectionChanged={(ids) => setSelectedId(ids[0])}
    renderItem={(item) => (
        <GtkLabel label={item?.text ?? ""} />
    )}
>
    {items.map(item => (
        <ListItem key={item.id} id={item.id} value={item} />
    ))}
</ListView>
\`\`\`

**GridView** - Grid-based virtual scrolling:
\`\`\`tsx
<GridView<Item>
    vexpand
    minColumns={2}
    maxColumns={4}
    renderItem={(item) => (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkImage iconName={item?.icon ?? "image-missing"} />
            <GtkLabel label={item?.name ?? ""} />
        </GtkBox>
    )}
>
    {items.map(item => (
        <ListItem key={item.id} id={item.id} value={item} />
    ))}
</GridView>
\`\`\`

**GtkColumnView** - Table with sortable columns:
\`\`\`tsx
<GtkColumnView
    sortColumn="name"
    sortOrder={Gtk.SortType.ASCENDING}
    onSortChange={handleSort}
>
    <ColumnViewColumn<Item>
        title="Name"
        id="name"
        expand
        sortable
        renderCell={(item) => (
            <GtkLabel label={item?.name ?? ""} />
        )}
    />
    {items.map(item => (
        <ListItem key={item.id} id={item.id} value={item} />
    ))}
</GtkColumnView>
\`\`\`

**GtkDropDown** - String selection widget:
\`\`\`tsx
<GtkDropDown onSelectionChanged={setSelectedId}>
    {options.map(opt => (
        <SimpleListItem key={opt.id} id={opt.id} value={opt.label} />
    ))}
</GtkDropDown>
\`\`\`

### GtkHeaderBar

Pack widgets at start and end of the title bar using Slot or Pack components:
\`\`\`tsx
<GtkHeaderBar>
    <Pack.Start>
        <GtkButton iconName="go-previous-symbolic" />
    </Pack.Start>
    <Slot for={GtkHeaderBar} id="titleWidget">
        <GtkLabel label="My App" cssClasses={["title"]} />
    </Slot>
    <Pack.End>
        <GtkMenuButton iconName="open-menu-symbolic" />
    </Pack.End>
</GtkHeaderBar>
\`\`\`

### GtkActionBar

Bottom bar with packed widgets:
\`\`\`tsx
<GtkActionBar>
    <Pack.Start>
        <GtkButton label="Cancel" />
    </Pack.Start>
    <Pack.End>
        <GtkButton label="Save" cssClasses={["suggested-action"]} />
    </Pack.End>
</GtkActionBar>
\`\`\`

### Controlled Input

GtkEntry requires two-way binding:
\`\`\`tsx
const [text, setText] = useState("");

<GtkEntry
    text={text}
    onChanged={(entry) => setText(entry.getText())}
    placeholderText="Type here..."
/>
\`\`\`

### Declarative Menus

\`\`\`tsx
<GtkPopoverMenu>
    <Menu.Section>
        <Menu.Item
            id="new"
            label="New"
            onActivate={handleNew}
            accels="<Control>n"
        />
    </Menu.Section>
    <Menu.Section>
        <Menu.Submenu label="Export">
            <Menu.Item id="pdf" label="PDF" onActivate={handleExportPdf} />
            <Menu.Item id="csv" label="CSV" onActivate={handleExportCsv} />
        </Menu.Submenu>
    </Menu.Section>
    <Menu.Section>
        <Menu.Item id="quit" label="Quit" onActivate={quit} accels="<Control>q" />
    </Menu.Section>
</GtkPopoverMenu>
\`\`\`

## Signal Handling

GTK signals map to \`on<SignalName>\` props:
- \`clicked\` → \`onClicked\`
- \`toggled\` → \`onToggled\`
- \`changed\` → \`onChanged\`
- \`notify::selected\` → \`onNotifySelected\`

## Widget References

\`\`\`tsx
import { useRef } from "react";

const entryRef = useRef<Gtk.Entry | null>(null);
<GtkEntry ref={entryRef} />
\`\`\`

## Portals

\`\`\`tsx
import { createPortal } from "@gtkx/react";

{createPortal(<GtkAboutDialog programName="My App" />)}
\`\`\`

## Constraints

- **GTK is single-threaded**: All widget operations on main thread
- **Virtual lists need immutable data**: Use stable object references
- **GtkToggleButton auto-prevents feedback loops**: Safe for controlled state
- **GtkEntry needs two-way binding**: Use \`onChanged\` to sync state

For detailed widget reference, see [WIDGETS.md](WIDGETS.md).
For code examples, see [EXAMPLES.md](EXAMPLES.md).
`;
};

const generateWidgetsMd = (): string => {
    return `# GTKX Widget Reference

## Container Widgets

### GtkBox
Linear layout container.

\`\`\`tsx
<GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
    <GtkLabel label="Child 1" />
    <GtkLabel label="Child 2" />
</GtkBox>
\`\`\`

Props:
- \`orientation\`: \`Gtk.Orientation.HORIZONTAL\` | \`Gtk.Orientation.VERTICAL\`
- \`spacing\`: number (pixels between children)
- \`homogeneous\`: boolean (equal child sizes)

### GtkGrid
2D grid layout with explicit positioning.

\`\`\`tsx
<GtkGrid rowSpacing={5} columnSpacing={5}>
    <GridChild column={0} row={0}>
        <GtkLabel label="Top-left" />
    </GridChild>
    <GridChild column={1} row={0} columnSpan={2}>
        <GtkLabel label="Spans 2 columns" />
    </GridChild>
</GtkGrid>
\`\`\`

GridChild props (consumed, not passed to GTK):
- \`column\`: number (0-indexed)
- \`row\`: number (0-indexed)
- \`columnSpan\`: number (default 1)
- \`rowSpan\`: number (default 1)

### GtkStack
Shows one child at a time, switchable by name.

\`\`\`tsx
<GtkStack visibleChildName="page1">
    <StackPage name="page1" title="First" iconName="document-new">
        <Content1 />
    </StackPage>
    <StackPage name="page2" title="Second">
        <Content2 />
    </StackPage>
</GtkStack>
\`\`\`

StackPage props (consumed):
- \`name\`: string (required, unique identifier)
- \`title\`: string (display title)
- \`iconName\`: string (icon name)

### GtkNotebook
Tabbed container with visible tabs.

\`\`\`tsx
<GtkNotebook>
    <NotebookPage label="Tab 1">
        <Content1 />
    </NotebookPage>
    <NotebookPage label="Tab 2">
        <Content2 />
    </NotebookPage>
</GtkNotebook>
\`\`\`

NotebookPage props (consumed):
- \`label\`: string (tab label)

### GtkPaned
Resizable split container with draggable divider.

\`\`\`tsx
<GtkPaned
    orientation={Gtk.Orientation.HORIZONTAL}
    position={280}
    shrinkStartChild={false}
    shrinkEndChild={false}
>
    <Slot for={GtkPaned} id="startChild">
        <SidePanel />
    </Slot>
    <Slot for={GtkPaned} id="endChild">
        <MainContent />
    </Slot>
</GtkPaned>
\`\`\`

Props:
- \`orientation\`: \`Gtk.Orientation.HORIZONTAL\` | \`Gtk.Orientation.VERTICAL\`
- \`position\`: number (divider position in pixels)
- \`shrinkStartChild\`: boolean
- \`shrinkEndChild\`: boolean

## Virtual Scrolling Widgets

### ListView
High-performance scrollable list with virtual rendering and selection support.

\`\`\`tsx
<ListView<Item>
    vexpand
    selected={[selectedId]}
    selectionMode={Gtk.SelectionMode.SINGLE}
    onSelectionChanged={(ids) => setSelectedId(ids[0])}
    renderItem={(item) => (
        <GtkLabel label={item?.text ?? ""} />
    )}
>
    {items.map(item => (
        <ListItem key={item.id} id={item.id} value={item} />
    ))}
</ListView>
\`\`\`

Props:
- \`renderItem\`: \`(item: T | null) => ReactElement\` (required)
- \`selected\`: string[] (array of selected item IDs)
- \`selectionMode\`: \`Gtk.SelectionMode.SINGLE\` | \`MULTIPLE\` | \`NONE\`
- \`onSelectionChanged\`: \`(ids: string[]) => void\`

ListItem props:
- \`id\`: string (required, unique identifier for selection)
- \`value\`: T (the data item)

### GridView
Grid-based virtual scrolling. Same API as ListView but renders items in a grid.

\`\`\`tsx
<GridView<Item>
    vexpand
    minColumns={2}
    maxColumns={4}
    renderItem={(item) => (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkImage iconName={item?.icon ?? "image-missing"} />
            <GtkLabel label={item?.name ?? ""} />
        </GtkBox>
    )}
>
    {items.map(item => (
        <ListItem key={item.id} id={item.id} value={item} />
    ))}
</GridView>
\`\`\`

### GtkColumnView
Table with sortable columns.

\`\`\`tsx
<GtkColumnView
    sortColumn="name"
    sortOrder={Gtk.SortType.ASCENDING}
    onSortChange={(column, order) => handleSort(column, order)}
>
    <ColumnViewColumn<Item>
        title="Name"
        id="name"
        expand
        resizable
        sortable
        renderCell={(item) => (
            <GtkLabel label={item?.name ?? ""} />
        )}
    />
    {items.map(item => (
        <ListItem key={item.id} id={item.id} value={item} />
    ))}
</GtkColumnView>
\`\`\`

ColumnViewColumn props:
- \`title\`: string (column header)
- \`id\`: string (used for sorting)
- \`expand\`: boolean (fill available space)
- \`resizable\`: boolean (user can resize)
- \`sortable\`: boolean (clicking header triggers sort)
- \`fixedWidth\`: number (fixed width in pixels)
- \`renderCell\`: \`(item: T | null) => ReactElement\`

### GtkDropDown
String selection dropdown.

\`\`\`tsx
<GtkDropDown onSelectionChanged={setSelectedId}>
    {options.map(opt => (
        <SimpleListItem key={opt.id} id={opt.id} value={opt.label} />
    ))}
</GtkDropDown>
\`\`\`

SimpleListItem props:
- \`id\`: string (unique identifier)
- \`value\`: string (display text)

## Header Widgets

### GtkHeaderBar
Title bar with packed widgets at start and end.

\`\`\`tsx
<GtkHeaderBar>
    <Pack.Start>
        <GtkButton iconName="go-previous-symbolic" />
    </Pack.Start>
    <Slot for={GtkHeaderBar} id="titleWidget">
        <GtkLabel label="My App" cssClasses={["title"]} />
    </Slot>
    <Pack.End>
        <GtkMenuButton iconName="open-menu-symbolic" />
    </Pack.End>
</GtkHeaderBar>
\`\`\`

### GtkActionBar
Bottom action bar with start/end packing.

\`\`\`tsx
<GtkActionBar>
    <Pack.Start>
        <GtkButton label="Cancel" />
    </Pack.Start>
    <Pack.End>
        <GtkButton label="Save" cssClasses={["suggested-action"]} />
    </Pack.End>
</GtkActionBar>
\`\`\`

## Input Widgets

### GtkEntry
Single-line text input. Requires two-way binding for controlled behavior.

\`\`\`tsx
const [text, setText] = useState("");

<GtkEntry
    text={text}
    onChanged={(entry) => setText(entry.getText())}
    placeholderText="Enter text..."
/>
\`\`\`

### GtkToggleButton
Toggle button with controlled state. Auto-prevents signal feedback loops.

\`\`\`tsx
const [active, setActive] = useState(false);

<GtkToggleButton
    active={active}
    onToggled={() => setActive(!active)}
    label="Toggle me"
/>
\`\`\`

## Display Widgets

### GtkLabel
\`\`\`tsx
<GtkLabel label="Hello World" halign={Gtk.Align.START} wrap useMarkup />
\`\`\`

### GtkButton
\`\`\`tsx
<GtkButton label="Click me" onClicked={() => handleClick()} iconName="document-new" />
\`\`\`

### GtkMenuButton
\`\`\`tsx
<GtkMenuButton label="Options" iconName="open-menu">
    <Slot for={GtkMenuButton} id="popover">
        <GtkPopoverMenu>
            <Menu.Item id="action" label="Action" onActivate={handle} />
        </GtkPopoverMenu>
    </Slot>
</GtkMenuButton>
\`\`\`

## Menu Widgets

### GtkPopoverMenu
\`\`\`tsx
<GtkPopoverMenu>
    <Menu.Section>
        <Menu.Item id="new" label="New" onActivate={handleNew} accels="<Control>n" />
    </Menu.Section>
    <Menu.Section>
        <Menu.Submenu label="File">
            <Menu.Item id="open" label="Open" onActivate={handleOpen} />
            <Menu.Item id="save" label="Save" onActivate={handleSave} />
        </Menu.Submenu>
    </Menu.Section>
    <Menu.Section>
        <Menu.Item id="quit" label="Quit" onActivate={quit} accels="<Control>q" />
    </Menu.Section>
</GtkPopoverMenu>
\`\`\`

### Menu.Item
Props:
- \`id\`: string (required, unique identifier)
- \`label\`: string
- \`onActivate\`: \`() => void\`
- \`accels\`: string | string[] (e.g., "<Control>n")

### Menu.Section
Groups menu items with optional label.

### Menu.Submenu
Nested submenu.

## Window Widgets

### GtkApplicationWindow
\`\`\`tsx
<GtkApplicationWindow
    title="My App"
    defaultWidth={800}
    defaultHeight={600}
    showMenubar
    onCloseRequest={quit}
>
    <MainContent />
</GtkApplicationWindow>
\`\`\`

## Common Props

All widgets support:
- \`hexpand\` / \`vexpand\`: boolean (expand to fill space)
- \`halign\` / \`valign\`: \`Gtk.Align.START\` | \`CENTER\` | \`END\` | \`FILL\`
- \`marginStart\` / \`marginEnd\` / \`marginTop\` / \`marginBottom\`: number
- \`sensitive\`: boolean (enabled/disabled)
- \`visible\`: boolean
- \`cssClasses\`: string[]
`;
};

const generateExamplesMd = (): string => {
    return `# GTKX Code Examples

## Application Structure

### Basic App with State

\`\`\`tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, GtkBox, GtkLabel, quit } from "@gtkx/react";
import { useCallback, useState } from "react";

interface Todo {
    id: number;
    text: string;
    completed: boolean;
}

let nextId = 1;

export const App = () => {
    const [todos, setTodos] = useState<Todo[]>([]);

    const addTodo = useCallback((text: string) => {
        setTodos((prev) => [...prev, { id: nextId++, text, completed: false }]);
    }, []);

    const toggleTodo = useCallback((id: number) => {
        setTodos((prev) =>
            prev.map((todo) =>
                todo.id === id ? { ...todo, completed: !todo.completed } : todo
            )
        );
    }, []);

    return (
        <GtkApplicationWindow title="Todo App" defaultWidth={400} defaultHeight={500} onCloseRequest={quit}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16} marginTop={16} marginStart={16} marginEnd={16}>
                <GtkLabel label="Todo App" />
            </GtkBox>
        </GtkApplicationWindow>
    );
};

export const appId = "com.gtkx.todo";
\`\`\`

## Layout Patterns

### Grid for Forms

\`\`\`tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkEntry, GtkGrid, GtkLabel, GridChild } from "@gtkx/react";
import { useState } from "react";

const FormLayout = () => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    return (
        <GtkGrid rowSpacing={8} columnSpacing={12}>
            <GridChild column={0} row={0}>
                <GtkLabel label="Name:" halign={Gtk.Align.END} />
            </GridChild>
            <GridChild column={1} row={0}>
                <GtkEntry text={name} onChanged={(e) => setName(e.getText())} hexpand />
            </GridChild>
            <GridChild column={0} row={1}>
                <GtkLabel label="Email:" halign={Gtk.Align.END} />
            </GridChild>
            <GridChild column={1} row={1}>
                <GtkEntry text={email} onChanged={(e) => setEmail(e.getText())} hexpand />
            </GridChild>
            <GridChild column={0} row={2} columnSpan={2}>
                <GtkButton label="Submit" halign={Gtk.Align.END} marginTop={8} />
            </GridChild>
        </GtkGrid>
    );
};
\`\`\`

### Stack with StackSwitcher

\`\`\`tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkStack, GtkStackSwitcher, StackPage } from "@gtkx/react";

const TabContainer = () => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <GtkStackSwitcher
            ref={(switcher: Gtk.StackSwitcher | null) => {
                if (switcher) {
                    const stack = switcher.getParent()?.getLastChild() as Gtk.Stack | null;
                    if (stack) switcher.setStack(stack);
                }
            }}
        />
        <GtkStack transitionType={Gtk.StackTransitionType.SLIDE_LEFT_RIGHT} transitionDuration={200}>
            <StackPage name="page1" title="First">
                <GtkLabel label="First Page Content" />
            </StackPage>
            <StackPage name="page2" title="Second">
                <GtkLabel label="Second Page Content" />
            </StackPage>
        </GtkStack>
    </GtkBox>
);
\`\`\`

## Virtual Scrolling Lists

### ListView with Selection

\`\`\`tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkScrolledWindow, ListView, ListItem } from "@gtkx/react";
import { useState } from "react";

interface Task {
    id: string;
    title: string;
    completed: boolean;
}

const tasks: Task[] = [
    { id: "1", title: "Learn GTK4", completed: true },
    { id: "2", title: "Build React app", completed: false },
];

const TaskList = () => {
    const [selectedId, setSelectedId] = useState<string | undefined>();

    return (
        <GtkBox cssClasses={["card"]} heightRequest={250}>
            <GtkScrolledWindow vexpand>
                <ListView<Task>
                    vexpand
                    selected={selectedId ? [selectedId] : []}
                    onSelectionChanged={(ids) => setSelectedId(ids[0])}
                    renderItem={(task) => (
                        <GtkLabel
                            label={task?.title ?? ""}
                            cssClasses={task?.completed ? ["dim-label"] : []}
                            halign={Gtk.Align.START}
                            marginStart={12}
                            marginTop={8}
                            marginBottom={8}
                        />
                    )}
                >
                    {tasks.map((task) => (
                        <ListItem key={task.id} id={task.id} value={task} />
                    ))}
                </ListView>
            </GtkScrolledWindow>
        </GtkBox>
    );
};
\`\`\`

### HeaderBar with Navigation

\`\`\`tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, GtkBox, GtkButton, GtkHeaderBar, GtkLabel, GtkWindow, Pack, Slot, quit } from "@gtkx/react";
import { useState } from "react";

const AppWithHeaderBar = () => {
    const [page, setPage] = useState("home");

    return (
        <GtkApplicationWindow title="My App" defaultWidth={600} defaultHeight={400} onCloseRequest={quit}>
            <Slot for={GtkWindow} id="titlebar">
                <GtkHeaderBar>
                    <Pack.Start>
                        {page !== "home" && (
                            <GtkButton iconName="go-previous-symbolic" onClicked={() => setPage("home")} />
                        )}
                    </Pack.Start>
                    <Pack.End>
                        <GtkButton iconName="emblem-system-symbolic" onClicked={() => setPage("settings")} />
                    </Pack.End>
                </GtkHeaderBar>
            </Slot>
            <GtkLabel label={page === "home" ? "Home Page" : "Settings Page"} vexpand />
        </GtkApplicationWindow>
    );
};
\`\`\`

## Menus

### MenuButton with PopoverMenu

\`\`\`tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkMenuButton, GtkPopoverMenu, Menu, Slot } from "@gtkx/react";
import { useState } from "react";

const MenuDemo = () => {
    const [lastAction, setLastAction] = useState<string | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkLabel label={\`Last action: \${lastAction ?? "(none)"}\`} />
            <GtkMenuButton label="Actions">
                <Slot for={GtkMenuButton} id="popover">
                    <GtkPopoverMenu>
                        <Menu.Item id="new" label="New" onActivate={() => setLastAction("New")} accels="<Control>n" />
                        <Menu.Item id="open" label="Open" onActivate={() => setLastAction("Open")} accels="<Control>o" />
                        <Menu.Item id="save" label="Save" onActivate={() => setLastAction("Save")} accels="<Control>s" />
                    </GtkPopoverMenu>
                </Slot>
            </GtkMenuButton>
        </GtkBox>
    );
};
\`\`\`

## Component Props Pattern

### List Item Component

\`\`\`tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkLabel } from "@gtkx/react";

interface Todo {
    id: number;
    text: string;
    completed: boolean;
}

interface TodoItemProps {
    todo: Todo;
    onToggle: (id: number) => void;
    onDelete: (id: number) => void;
}

export const TodoItem = ({ todo, onToggle, onDelete }: TodoItemProps) => (
    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
        <GtkCheckButton active={todo.completed} onToggled={() => onToggle(todo.id)} />
        <GtkLabel label={todo.text} hexpand cssClasses={todo.completed ? ["dim-label"] : []} />
        <GtkButton iconName="edit-delete-symbolic" onClicked={() => onDelete(todo.id)} cssClasses={["flat"]} />
    </GtkBox>
);
\`\`\`
`;
};

const generateExampleTest = (testing: TestingFramework): string => {
    const imports =
        testing === "vitest"
            ? `import { describe, it, expect, afterEach } from "vitest";`
            : testing === "jest"
              ? `import { describe, it, expect, afterEach } from "@jest/globals";`
              : `import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";`;

    const afterEachFn = testing === "node" ? "after" : "afterEach";
    const assertion =
        testing === "node" ? `assert.ok(button, "Button should be rendered");` : `expect(button).toBeDefined();`;

    return `${imports}
import * as Gtk from "@gtkx/ffi/gtk";
import { cleanup, render, screen } from "@gtkx/testing";
import App from "../src/app.js";

${afterEachFn}(async () => {
    await cleanup();
});

describe("App", () => {
    it("renders the increment button", async () => {
        await render(<App />, { wrapper: false });
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" });
        ${assertion}
    });
});
`;
};

const generateVitestConfig = (): string => {
    return `import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.{ts,tsx}"],
        globals: false,
    },
    esbuild: {
        jsx: "automatic",
    },
});
`;
};

const generateJestConfig = (): string => {
    return `/** @type {import('jest').Config} */
export default {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.ts"],
    extensionsToTreatAsEsm: [".ts", ".tsx"],
    moduleNameMapper: {
        "^(\\\\.{1,2}/.*)\\\\.js$": "$1",
    },
    transform: {
        "^.+\\\\.tsx?$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: "tsconfig.json",
            },
        ],
    },
};
`;
};

export const getAddCommand = (pm: PackageManager, deps: string[], dev: boolean): string => {
    const devFlag = dev ? (pm === "npm" ? "--save-dev" : "-D") : "";
    const parts = [devFlag, ...deps].filter(Boolean).join(" ");

    switch (pm) {
        case "npm":
            return `npm install ${parts}`;
        case "yarn":
            return `yarn add ${parts}`;
        case "pnpm":
            return `pnpm add ${parts}`;
        case "bun":
            return `bun add ${parts}`;
    }
};

export const getRunCommand = (pm: PackageManager): string => {
    switch (pm) {
        case "npm":
            return "npm run dev";
        case "yarn":
            return "yarn dev";
        case "pnpm":
            return "pnpm dev";
        case "bun":
            return "bun dev";
    }
};

export const isValidProjectName = (name: string): boolean => {
    return /^[a-z0-9-]+$/.test(name);
};

export const isValidAppId = (appId: string): boolean => {
    return /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(appId);
};

const runCommand = (command: string, cwd: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, { cwd, stdio: "pipe", shell: true });
        proc.on("close", (code) =>
            code === 0 ? resolve() : reject(new Error(`Command failed with exit code ${code}`)),
        );
        proc.on("error", reject);
    });
};

const suggestAppId = (name: string): string => {
    const sanitized = name.replace(/-/g, "");
    return `org.gtkx.${sanitized}`;
};

type ResolvedOptions = {
    name: string;
    appId: string;
    packageManager: PackageManager;
    testing: TestingFramework;
    claudeSkills: boolean;
};

const checkCancelled = <T>(value: T | symbol): T => {
    if (p.isCancel(value)) {
        p.cancel("Operation cancelled");
        process.exit(0);
    }
    return value as T;
};

const promptForOptions = async (options: CreateOptions): Promise<ResolvedOptions> => {
    const name =
        options.name ??
        checkCancelled(
            await p.text({
                message: "Project name",
                placeholder: "my-app",
                validate: (value) => {
                    if (!value) return "Project name is required";
                    if (!isValidProjectName(value)) {
                        return "Project name must be lowercase letters, numbers, and hyphens only";
                    }
                    if (existsSync(resolve(process.cwd(), value))) {
                        return `Directory "${value}" already exists`;
                    }
                },
            }),
        );

    const defaultAppId = suggestAppId(name);
    const appId =
        options.appId ??
        checkCancelled(
            await p.text({
                message: "App ID",
                placeholder: defaultAppId,
                initialValue: defaultAppId,
                validate: (value) => {
                    if (!value) return "App ID is required";
                    if (!isValidAppId(value)) {
                        return "App ID must be reverse domain notation (e.g., com.example.myapp)";
                    }
                },
            }),
        );

    const packageManager =
        options.packageManager ??
        checkCancelled(
            await p.select({
                message: "Package manager",
                options: [
                    { value: "pnpm", label: "pnpm", hint: "recommended" },
                    { value: "npm", label: "npm" },
                    { value: "yarn", label: "yarn" },
                    { value: "bun", label: "bun" },
                ],
                initialValue: "pnpm",
            }),
        );

    const testing =
        options.testing ??
        checkCancelled(
            await p.select({
                message: "Testing framework",
                options: [
                    { value: "vitest", label: "Vitest", hint: "recommended" },
                    { value: "jest", label: "Jest" },
                    { value: "node", label: "Node.js Test Runner" },
                    { value: "none", label: "None" },
                ],
                initialValue: "vitest",
            }),
        );

    const claudeSkills =
        options.claudeSkills ??
        checkCancelled(
            await p.confirm({
                message: "Include Claude Code skills?",
                initialValue: true,
            }),
        );

    return { name, appId, packageManager, testing, claudeSkills };
};

const scaffoldProject = (projectPath: string, resolved: ResolvedOptions): void => {
    const { name, appId, testing, claudeSkills } = resolved;

    mkdirSync(projectPath, { recursive: true });
    mkdirSync(join(projectPath, "src"), { recursive: true });

    if (testing !== "none") {
        mkdirSync(join(projectPath, "tests"), { recursive: true });
    }

    writeFileSync(join(projectPath, "package.json"), generatePackageJson(name, appId, testing));
    writeFileSync(join(projectPath, "tsconfig.json"), generateTsConfig());
    writeFileSync(join(projectPath, "src", "app.tsx"), generateAppTsx(name));
    writeFileSync(join(projectPath, "src", "dev.tsx"), generateDevTsx());
    writeFileSync(join(projectPath, "src", "index.tsx"), generateIndexTsx(appId));
    writeFileSync(join(projectPath, ".gitignore"), generateGitignore());

    if (claudeSkills) {
        const skillsDir = join(projectPath, ".claude", "skills", "developing-gtkx-apps");
        mkdirSync(skillsDir, { recursive: true });
        writeFileSync(join(skillsDir, "SKILL.md"), generateSkillMd());
        writeFileSync(join(skillsDir, "WIDGETS.md"), generateWidgetsMd());
        writeFileSync(join(skillsDir, "EXAMPLES.md"), generateExamplesMd());
    }

    if (testing === "vitest") {
        writeFileSync(join(projectPath, "vitest.config.ts"), generateVitestConfig());
        writeFileSync(join(projectPath, "tests", "app.test.tsx"), generateExampleTest(testing));
    } else if (testing === "jest") {
        writeFileSync(join(projectPath, "jest.config.js"), generateJestConfig());
        writeFileSync(join(projectPath, "tests", "app.test.tsx"), generateExampleTest(testing));
    } else if (testing === "node") {
        writeFileSync(join(projectPath, "tests", "app.test.tsx"), generateExampleTest(testing));
    }
};

const getDevDependencies = (testing: TestingFramework): string[] => {
    const devDeps = [...DEV_DEPENDENCIES];
    if (testing !== "none") {
        devDeps.push(...TESTING_DEV_DEPENDENCIES[testing]);
        if (testing === "node") {
            devDeps.push("tsx");
        }
    }
    return devDeps;
};

const installDependencies = async (
    projectPath: string,
    name: string,
    packageManager: PackageManager,
    devDeps: string[],
): Promise<void> => {
    const installSpinner = p.spinner();
    installSpinner.start("Installing dependencies...");

    try {
        const addCmd = getAddCommand(packageManager, DEPENDENCIES, false);
        await runCommand(addCmd, projectPath);

        const addDevCmd = getAddCommand(packageManager, devDeps, true);
        await runCommand(addDevCmd, projectPath);

        installSpinner.stop("Dependencies installed!");
    } catch (error) {
        installSpinner.stop("Failed to install dependencies");
        p.log.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        p.log.info("You can install dependencies manually by running:");
        p.log.info(`  cd ${name}`);
        p.log.info(`  ${getAddCommand(packageManager, DEPENDENCIES, false)}`);
        p.log.info(`  ${getAddCommand(packageManager, devDeps, true)}`);
    }
};

const printNextSteps = (name: string, packageManager: PackageManager, testing: TestingFramework): void => {
    const runCmd = getRunCommand(packageManager);
    const nextSteps = `cd ${name}\n${runCmd}`;

    const testingNote =
        testing !== "none"
            ? `

To run tests, you need xvfb installed:
  Fedora: sudo dnf install xorg-x11-server-Xvfb
  Ubuntu: sudo apt install xvfb`
            : "";

    p.note(`${nextSteps}${testingNote}`, "Next steps");
};

export const createApp = async (options: CreateOptions = {}): Promise<void> => {
    p.intro("Create GTKX App");

    const resolved = await promptForOptions(options);
    const projectPath = resolve(process.cwd(), resolved.name);

    const s = p.spinner();
    s.start("Creating project structure...");
    scaffoldProject(projectPath, resolved);
    s.stop("Project structure created!");

    const devDeps = getDevDependencies(resolved.testing);
    await installDependencies(projectPath, resolved.name, resolved.packageManager, devDeps);

    printNextSteps(resolved.name, resolved.packageManager, resolved.testing);
};
