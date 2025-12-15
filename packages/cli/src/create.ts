import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";

/** Supported package managers for project scaffolding. */
export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

/** Supported testing frameworks for project scaffolding. */
export type TestingFramework = "vitest" | "jest" | "node" | "none";

/**
 * Options for creating a new GTKX application.
 */
export type CreateOptions = {
    /** Project name (lowercase letters, numbers, and hyphens only). */
    name?: string;
    /** Application ID in reverse domain notation (e.g., com.example.myapp). */
    appId?: string;
    /** Package manager to use for installing dependencies. */
    packageManager?: PackageManager;
    /** Testing framework to set up. */
    testing?: TestingFramework;
    /** Whether to include Claude Code skills for AI assistance. */
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
    switch (testing) {
        case "vitest":
            return "GDK_BACKEND=x11 xvfb-run -a vitest";
        case "jest":
            return "GDK_BACKEND=x11 xvfb-run -a jest";
        case "node":
            return "GDK_BACKEND=x11 xvfb-run -a node --import tsx --test tests/**/*.test.ts";
        case "none":
            return undefined;
    }
};

export const generatePackageJson = (name: string, appId: string, testing: TestingFramework): string => {
    const testScript = getTestScript(testing);
    const scripts: Record<string, string> = {
        dev: "gtkx dev src/app.tsx",
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
                outDir: "dist",
                rootDir: "src",
            },
            include: ["src/**/*"],
        },
        null,
        4,
    );
};

const generateAppTsx = (name: string, appId: string): string => {
    const title = name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    return `import { useState } from "react";
import * as Gtk from "@gtkx/ffi/gtk";
import { ApplicationWindow, Box, Button, Label, quit } from "@gtkx/react";

export default function App() {
    const [count, setCount] = useState(0);

    return (
        <ApplicationWindow title="${title}" defaultWidth={400} defaultHeight={300} onCloseRequest={quit}>
            <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginTop={40} marginStart={40} marginEnd={40}>
                <Label label="Welcome to GTKX!" />
                <Label label={\`Count: \${count}\`} />
                <Button label="Increment" onClicked={() => setCount((c) => c + 1)} />
            </Box>
        </ApplicationWindow>
    );
}

export const appId = "${appId}";
`;
};

const generateIndexTsx = (): string => {
    return `import { render } from "@gtkx/react";
import App, { appId } from "./app.js";

render(<App />, appId);
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
import { ApplicationWindow, render, quit } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

const App = () => (
    <ApplicationWindow title="My App" defaultWidth={800} defaultHeight={600}>
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <Label label="Hello, GTKX!" />
            <Button label="Quit" onClicked={quit} />
        </Box>
    </ApplicationWindow>
);

render(<App />, "com.example.myapp");
\`\`\`

## Widget Patterns

### Container Widgets

**Box** - Linear layout:
\`\`\`tsx
<Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
    <Label label="First" />
    <Label label="Second" />
</Box>
\`\`\`

**Grid** - 2D positioning:
\`\`\`tsx
<Grid.Root spacing={10}>
    <Grid.Child column={0} row={0}>
        <Label label="Top-left" />
    </Grid.Child>
    <Grid.Child column={1} row={0} columnSpan={2}>
        <Label label="Spans 2 columns" />
    </Grid.Child>
</Grid.Root>
\`\`\`

**Stack** - Page-based container:
\`\`\`tsx
<Stack.Root visibleChildName="page1">
    <Stack.Page name="page1" title="Page 1">
        <Label label="Content 1" />
    </Stack.Page>
    <Stack.Page name="page2" title="Page 2">
        <Label label="Content 2" />
    </Stack.Page>
</Stack.Root>
\`\`\`

**Notebook** - Tabbed container:
\`\`\`tsx
<Notebook.Root>
    <Notebook.Page label="Tab 1">
        <Content1 />
    </Notebook.Page>
    <Notebook.Page label="Tab 2">
        <Content2 />
    </Notebook.Page>
</Notebook.Root>
\`\`\`

**Paned** - Resizable split:
\`\`\`tsx
<Paned.Root orientation={Gtk.Orientation.HORIZONTAL} position={280}>
    <Paned.StartChild>
        <SideBar />
    </Paned.StartChild>
    <Paned.EndChild>
        <MainContent />
    </Paned.EndChild>
</Paned.Root>
\`\`\`

### Virtual Scrolling Lists

**ListView** - High-performance scrollable list:
\`\`\`tsx
<ListView.Root
    vexpand
    renderItem={(item: Item | null) => (
        <Label label={item?.text ?? ""} />
    )}
>
    {items.map(item => (
        <ListView.Item key={item.id} item={item} />
    ))}
</ListView.Root>
\`\`\`

**ColumnView** - Table with columns:
\`\`\`tsx
<ColumnView.Root
    sortColumn="name"
    sortOrder={Gtk.SortType.ASCENDING}
    onSortChange={handleSort}
>
    <ColumnView.Column
        title="Name"
        id="name"
        expand
        renderCell={(item: Item | null) => (
            <Label label={item?.name ?? ""} />
        )}
    />
    {items.map(item => (
        <ColumnView.Item key={item.id} item={item} />
    ))}
</ColumnView.Root>
\`\`\`

**DropDown** - Selection widget:
\`\`\`tsx
<DropDown.Root
    itemLabel={(opt: Option) => opt.label}
    onSelectionChanged={(item, index) => setSelected(item.value)}
>
    {options.map(opt => (
        <DropDown.Item key={opt.value} item={opt} />
    ))}
</DropDown.Root>
\`\`\`

### Controlled Input

Entry requires two-way binding:
\`\`\`tsx
const [text, setText] = useState("");

<Entry
    text={text}
    onChanged={(entry) => setText(entry.getText())}
    placeholder="Type here..."
/>
\`\`\`

### Declarative Menus

\`\`\`tsx
<ApplicationMenu>
    <Menu.Submenu label="File">
        <Menu.Item
            label="New"
            onActivate={handleNew}
            accels="<Control>n"
        />
        <Menu.Section>
            <Menu.Item label="Quit" onActivate={quit} accels="<Control>q" />
        </Menu.Section>
    </Menu.Submenu>
</ApplicationMenu>
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
<Entry ref={entryRef} />
// Later: entryRef.current?.getText()
\`\`\`

## Portals

\`\`\`tsx
import { createPortal } from "@gtkx/react";

{createPortal(<AboutDialog programName="My App" />)}
\`\`\`

## Constraints

- **GTK is single-threaded**: All widget operations on main thread
- **Virtual lists need immutable data**: Use stable object references
- **ToggleButton auto-prevents feedback loops**: Safe for controlled state
- **Entry needs two-way binding**: Use \`onChanged\` to sync state

For detailed widget reference, see [WIDGETS.md](WIDGETS.md).
For code examples, see [EXAMPLES.md](EXAMPLES.md).
`;
};

const generateWidgetsMd = (): string => {
    return `# GTKX Widget Reference

## Container Widgets

### Box
Linear layout container.

\`\`\`tsx
<Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
    <Label label="Child 1" />
    <Label label="Child 2" />
</Box>
\`\`\`

Props:
- \`orientation\`: \`Gtk.Orientation.HORIZONTAL\` | \`Gtk.Orientation.VERTICAL\`
- \`spacing\`: number (pixels between children)
- \`homogeneous\`: boolean (equal child sizes)

### Grid
2D grid layout with explicit positioning.

\`\`\`tsx
<Grid.Root spacing={10} rowSpacing={5} columnSpacing={5}>
    <Grid.Child column={0} row={0}>
        <Label label="Top-left" />
    </Grid.Child>
    <Grid.Child column={1} row={0} columnSpan={2}>
        <Label label="Spans 2 columns" />
    </Grid.Child>
</Grid.Root>
\`\`\`

Grid.Child props (consumed, not passed to GTK):
- \`column\`: number (0-indexed)
- \`row\`: number (0-indexed)
- \`columnSpan\`: number (default 1)
- \`rowSpan\`: number (default 1)

### Stack
Shows one child at a time, switchable by name.

\`\`\`tsx
<Stack.Root visibleChildName="page1">
    <Stack.Page name="page1" title="First" iconName="document-new">
        <Content1 />
    </Stack.Page>
    <Stack.Page name="page2" title="Second">
        <Content2 />
    </Stack.Page>
</Stack.Root>
\`\`\`

Stack.Page props (consumed):
- \`name\`: string (required, unique identifier)
- \`title\`: string (display title)
- \`iconName\`: string (icon name)

### Notebook
Tabbed container with visible tabs.

\`\`\`tsx
<Notebook.Root>
    <Notebook.Page label="Tab 1">
        <Content1 />
    </Notebook.Page>
    <Notebook.Page label="Tab 2">
        <Content2 />
    </Notebook.Page>
</Notebook.Root>
\`\`\`

Notebook.Page props (consumed):
- \`label\`: string (tab label)

### Paned
Resizable split container with draggable divider.

\`\`\`tsx
<Paned.Root
    orientation={Gtk.Orientation.HORIZONTAL}
    position={280}
    shrinkStartChild={false}
    shrinkEndChild={false}
>
    <Paned.StartChild>
        <SidePanel />
    </Paned.StartChild>
    <Paned.EndChild>
        <MainContent />
    </Paned.EndChild>
</Paned.Root>
\`\`\`

Props:
- \`orientation\`: \`Gtk.Orientation.HORIZONTAL\` | \`Gtk.Orientation.VERTICAL\`
- \`position\`: number (divider position in pixels)
- \`shrinkStartChild\`: boolean
- \`shrinkEndChild\`: boolean

## Virtual Scrolling Widgets

### ListView
High-performance scrollable list with virtual rendering.

\`\`\`tsx
<ListView.Root
    vexpand
    renderItem={(item: Item | null) => (
        <Label label={item?.text ?? ""} />
    )}
>
    {items.map(item => (
        <ListView.Item key={item.id} item={item} />
    ))}
</ListView.Root>
\`\`\`

Props:
- \`renderItem\`: \`(item: T | null) => ReactElement\` (required)
- Standard scrollable props

### ColumnView
Table with sortable columns.

\`\`\`tsx
<ColumnView.Root
    sortColumn="name"
    sortOrder={Gtk.SortType.ASCENDING}
    onSortChange={(column, order) => handleSort(column, order)}
>
    <ColumnView.Column
        title="Name"
        id="name"
        expand
        resizable
        renderCell={(item: Item | null) => (
            <Label label={item?.name ?? ""} />
        )}
    />
    {items.map(item => (
        <ColumnView.Item key={item.id} item={item} />
    ))}
</ColumnView.Root>
\`\`\`

### DropDown
Selection dropdown with custom rendering.

\`\`\`tsx
<DropDown.Root
    itemLabel={(opt: Option) => opt.label}
    onSelectionChanged={(item, index) => setSelected(item.value)}
>
    {options.map(opt => (
        <DropDown.Item key={opt.value} item={opt} />
    ))}
</DropDown.Root>
\`\`\`

## Input Widgets

### Entry
Single-line text input. Requires two-way binding for controlled behavior.

\`\`\`tsx
const [text, setText] = useState("");

<Entry
    text={text}
    onChanged={(entry) => setText(entry.getText())}
    placeholder="Enter text..."
/>
\`\`\`

### ToggleButton
Toggle button with controlled state. Auto-prevents signal feedback loops.

\`\`\`tsx
const [active, setActive] = useState(false);

<ToggleButton.Root
    active={active}
    onToggled={() => setActive(!active)}
    label="Toggle me"
/>
\`\`\`

## Display Widgets

### Label
\`\`\`tsx
<Label label="Hello World" halign={Gtk.Align.START} wrap useMarkup />
\`\`\`

### Button
\`\`\`tsx
<Button label="Click me" onClicked={() => handleClick()} iconName="document-new" />
\`\`\`

### MenuButton
\`\`\`tsx
<MenuButton.Root label="Options" iconName="open-menu">
    <MenuButton.Popover>
        <PopoverMenu.Root>
            <Menu.Item label="Action" onActivate={handle} />
        </PopoverMenu.Root>
    </MenuButton.Popover>
</MenuButton.Root>
\`\`\`

## Menu Widgets

### ApplicationMenu
\`\`\`tsx
<ApplicationMenu>
    <Menu.Submenu label="File">
        <Menu.Item label="New" onActivate={handleNew} accels="<Control>n" />
        <Menu.Section>
            <Menu.Item label="Quit" onActivate={quit} accels="<Control>q" />
        </Menu.Section>
    </Menu.Submenu>
</ApplicationMenu>
\`\`\`

### Menu.Item
Props:
- \`label\`: string
- \`onActivate\`: \`() => void\`
- \`accels\`: string | string[] (e.g., "<Control>n")

### Menu.Section
Groups menu items with optional label.

### Menu.Submenu
Nested submenu.

## Window Widgets

### ApplicationWindow
\`\`\`tsx
<ApplicationWindow
    title="My App"
    defaultWidth={800}
    defaultHeight={600}
    showMenubar
    onCloseRequest={() => false}
>
    <MainContent />
</ApplicationWindow>
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
import { Orientation } from "@gtkx/ffi/gtk";
import { ApplicationWindow, Box, Label, quit } from "@gtkx/react";
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
        <ApplicationWindow title="Todo App" defaultWidth={400} defaultHeight={500} onCloseRequest={quit}>
            <Box orientation={Orientation.VERTICAL} spacing={16} marginTop={16} marginStart={16} marginEnd={16}>
                <Label label="Todo App" />
            </Box>
        </ApplicationWindow>
    );
};

export const appId = "com.gtkx.todo";
\`\`\`

## Layout Patterns

### Grid for Forms

\`\`\`tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { Button, Entry, Grid, Label } from "@gtkx/react";
import { useState } from "react";

const FormLayout = () => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    return (
        <Grid.Root rowSpacing={8} columnSpacing={12}>
            <Grid.Child column={0} row={0}>
                <Label label="Name:" halign={Gtk.Align.END} />
            </Grid.Child>
            <Grid.Child column={1} row={0}>
                <Entry text={name} onChanged={(e) => setName(e.getText())} hexpand />
            </Grid.Child>
            <Grid.Child column={0} row={1}>
                <Label label="Email:" halign={Gtk.Align.END} />
            </Grid.Child>
            <Grid.Child column={1} row={1}>
                <Entry text={email} onChanged={(e) => setEmail(e.getText())} hexpand />
            </Grid.Child>
            <Grid.Child column={0} row={2} columnSpan={2}>
                <Button label="Submit" halign={Gtk.Align.END} marginTop={8} />
            </Grid.Child>
        </Grid.Root>
    );
};
\`\`\`

### Stack with StackSwitcher

\`\`\`tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, Stack, StackSwitcher } from "@gtkx/react";

const TabContainer = () => (
    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <StackSwitcher.Root
            ref={(switcher: Gtk.StackSwitcher | null) => {
                if (switcher) {
                    const stack = switcher.getParent()?.getLastChild() as Gtk.Stack | null;
                    if (stack) switcher.setStack(stack);
                }
            }}
        />
        <Stack.Root transitionType={Gtk.StackTransitionType.SLIDE_LEFT_RIGHT} transitionDuration={200}>
            <Stack.Page name="page1" title="First">
                <Label label="First Page Content" />
            </Stack.Page>
            <Stack.Page name="page2" title="Second">
                <Label label="Second Page Content" />
            </Stack.Page>
        </Stack.Root>
    </Box>
);
\`\`\`

## Virtual Scrolling Lists

### ListView with Custom Rendering

\`\`\`tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, ListView } from "@gtkx/react";

interface Task {
    id: string;
    title: string;
    completed: boolean;
}

const tasks: Task[] = [
    { id: "1", title: "Learn GTK4", completed: true },
    { id: "2", title: "Build React app", completed: false },
];

const TaskList = () => (
    <Box cssClasses={["card"]} heightRequest={250}>
        <ListView.Root
            vexpand
            renderItem={(task: Task | null) => (
                <Label
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
                <ListView.Item key={task.id} item={task} />
            ))}
        </ListView.Root>
    </Box>
);
\`\`\`

## Menus

### MenuButton with PopoverMenu

\`\`\`tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, Menu, MenuButton, PopoverMenu } from "@gtkx/react";
import { useState } from "react";

const MenuDemo = () => {
    const [lastAction, setLastAction] = useState<string | null>(null);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <Label label={\`Last action: \${lastAction ?? "(none)"}\`} />
            <MenuButton.Root label="Actions">
                <MenuButton.Popover>
                    <PopoverMenu.Root>
                        <Menu.Item label="New" onActivate={() => setLastAction("New")} accels="<Control>n" />
                        <Menu.Item label="Open" onActivate={() => setLastAction("Open")} accels="<Control>o" />
                        <Menu.Item label="Save" onActivate={() => setLastAction("Save")} accels="<Control>s" />
                    </PopoverMenu.Root>
                </MenuButton.Popover>
            </MenuButton.Root>
        </Box>
    );
};
\`\`\`

## Component Props Pattern

### List Item Component

\`\`\`tsx
import { Box, Button, CheckButton, Label } from "@gtkx/react";
import { Orientation } from "@gtkx/ffi/gtk";

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
    <Box orientation={Orientation.HORIZONTAL} spacing={8}>
        <CheckButton active={todo.completed} onToggled={() => onToggle(todo.id)} />
        <Label label={todo.text} hexpand cssClasses={todo.completed ? ["dim-label"] : []} />
        <Button iconName="edit-delete-symbolic" onClicked={() => onDelete(todo.id)} cssClasses={["flat"]} />
    </Box>
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
import { AccessibleRole } from "@gtkx/ffi/gtk";
import { cleanup, render, screen } from "@gtkx/testing";
import App from "../src/app.js";

${afterEachFn}(async () => {
    await cleanup();
});

describe("App", () => {
    it("renders the increment button", async () => {
        await render(<App />, { wrapper: false });
        const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Increment" });
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
    const packages = deps.join(" ");

    switch (pm) {
        case "npm":
            return `npm install ${devFlag} ${packages}`.trim();
        case "yarn":
            return `yarn add ${devFlag} ${packages}`.trim();
        case "pnpm":
            return `pnpm add ${devFlag} ${packages}`.trim();
        case "bun":
            return `bun add ${devFlag} ${packages}`.trim();
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

/**
 * Creates a new GTKX application with interactive prompts.
 * Scaffolds project structure, installs dependencies, and sets up configuration.
 * @param options - Pre-filled options to skip interactive prompts
 */
export const createApp = async (options: CreateOptions = {}): Promise<void> => {
    p.intro("Create GTKX App");

    const name =
        options.name ??
        ((await p.text({
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
                return undefined;
            },
        })) as string);

    if (p.isCancel(name)) {
        p.cancel("Operation cancelled");
        process.exit(0);
    }

    const defaultAppId = suggestAppId(name);
    const appId =
        options.appId ??
        ((await p.text({
            message: "App ID",
            placeholder: defaultAppId,
            initialValue: defaultAppId,
            validate: (value) => {
                if (!value) return "App ID is required";
                if (!isValidAppId(value)) {
                    return "App ID must be reverse domain notation (e.g., com.example.myapp)";
                }
                return undefined;
            },
        })) as string);

    if (p.isCancel(appId)) {
        p.cancel("Operation cancelled");
        process.exit(0);
    }

    const packageManager =
        options.packageManager ??
        ((await p.select({
            message: "Package manager",
            options: [
                { value: "pnpm", label: "pnpm", hint: "recommended" },
                { value: "npm", label: "npm" },
                { value: "yarn", label: "yarn" },
                { value: "bun", label: "bun" },
            ],
            initialValue: "pnpm",
        })) as PackageManager);

    if (p.isCancel(packageManager)) {
        p.cancel("Operation cancelled");
        process.exit(0);
    }

    const testing =
        options.testing ??
        ((await p.select({
            message: "Testing framework",
            options: [
                { value: "vitest", label: "Vitest", hint: "recommended" },
                { value: "jest", label: "Jest" },
                { value: "node", label: "Node.js Test Runner" },
                { value: "none", label: "None" },
            ],
            initialValue: "vitest",
        })) as TestingFramework);

    if (p.isCancel(testing)) {
        p.cancel("Operation cancelled");
        process.exit(0);
    }

    const claudeSkills =
        options.claudeSkills ??
        ((await p.confirm({
            message: "Include Claude Code skills?",
            initialValue: true,
        })) as boolean);

    if (p.isCancel(claudeSkills)) {
        p.cancel("Operation cancelled");
        process.exit(0);
    }

    const projectPath = resolve(process.cwd(), name);

    const s = p.spinner();
    s.start("Creating project structure...");

    mkdirSync(projectPath, { recursive: true });
    mkdirSync(join(projectPath, "src"), { recursive: true });

    if (testing !== "none") {
        mkdirSync(join(projectPath, "tests"), { recursive: true });
    }

    writeFileSync(join(projectPath, "package.json"), generatePackageJson(name, appId, testing));
    writeFileSync(join(projectPath, "tsconfig.json"), generateTsConfig());
    writeFileSync(join(projectPath, "src", "app.tsx"), generateAppTsx(name, appId));
    writeFileSync(join(projectPath, "src", "index.tsx"), generateIndexTsx());
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

    s.stop("Project structure created!");

    const installSpinner = p.spinner();
    installSpinner.start("Installing dependencies...");

    const devDeps = [...DEV_DEPENDENCIES];
    if (testing !== "none") {
        devDeps.push(...TESTING_DEV_DEPENDENCIES[testing]);
        if (testing === "node") {
            devDeps.push("tsx");
        }
    }

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

    const runCmd = getRunCommand(packageManager);

    const nextSteps = `cd ${name}
${runCmd}`;

    const testingNote =
        testing !== "none"
            ? `

To run tests, you need xvfb installed:
  Fedora: sudo dnf install xorg-x11-server-Xvfb
  Ubuntu: sudo apt install xvfb`
            : "";

    p.note(`${nextSteps}${testingNote}`, "Next steps");
};
