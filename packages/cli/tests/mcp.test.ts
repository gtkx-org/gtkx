import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProject } from "./project.js";
import { withSession, withMcpClient, callTool, writeWidgetApp, queryWidgets } from "./invoke.js";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("gtkx mcp", () => {
    it("summarizes widgets by their accessible name and effective sensitivity and reads boxed properties as text", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import * as Gdk from "@gtkx/gi/gdk";
            import { GtkBox, GtkButton, GtkColorDialog, GtkColorDialogButton, GtkLabel } from "@gtkx/jsx/gtk";
            const accent = new Gdk.RGBA({ red: 1, green: 0.5, blue: 0, alpha: 1 });
            export const Content = () => (
                <GtkBox>
                    <GtkButton iconName="list-add-symbolic" tooltipText="New Note" />
                    <GtkColorDialogButton tooltipText="Accent" rgba={accent} dialog={<GtkColorDialog />} />
                    <GtkLabel label="0.3048" accessibleLabel="Result value" />
                    <GtkBox sensitive={false}>
                        <GtkButton label="Locked" />
                    </GtkBox>
                </GtkBox>
            );`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                expect(await queryWidgets(client, { by: "name", value: "New Note" })).toEqual([
                    expect.objectContaining({ type: "Button", name: "New Note", isSensitive: true }),
                ]);
                expect(
                    await queryWidgets(client, { by: "role", value: "button", options: { name: "Locked" } }),
                ).toEqual([expect.objectContaining({ name: "Locked", isSensitive: false })]);
                expect(await queryWidgets(client, { by: "name", value: "Result value" })).toEqual([
                    expect.objectContaining({ type: "Label", text: "0.3048" }),
                ]);
                const [swatch] = await queryWidgets(client, { by: "name", value: "Accent" });
                const props = await callTool(client, "gtkx_get_widget_props", {
                    widgetId: swatch?.id,
                    properties: ["rgba"],
                    maxDepth: 0,
                });
                expect(JSON.parse(props.text)).toMatchObject({
                    properties: { rgba: { type: "GdkRGBA", value: "rgb(255,128,0)" } },
                });
            });
        });
    });

    it("keeps the dev session up when an MCP click makes the application throw", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        const content = (shouldThrow: boolean) =>
            `import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
            import { useLayoutEffect, useState } from "react";
            const Preview = ({ part }: { part: string }) => {
                useLayoutEffect(() => {
                    if (${String(shouldThrow)}) throw new Error(\`Showing the \${part} failed\`);
                }, []);
                return null;
            };
            export const Content = () => {
                const [isOpen, setIsOpen] = useState(false);
                return (
                    <GtkBox>
                        <GtkButton label="Open" onClicked={() => setIsOpen(true)} />
                        {isOpen && <><Preview part="header" /><Preview part="body" /></>}
                    </GtkBox>
                );
            };`;
        writeWidgetApp(project, readyPath, content(true));
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [button] = await queryWidgets(client, { by: "role", value: "button", options: { name: "Open" } });
                const click = await callTool(client, "gtkx_click", { widgetId: button?.id });
                expect(click.isError).toBe(true);
                expect(click.text).not.toBe("");
                rmSync(readyPath);
                project.write("src/content.tsx", content(false));
                await expect.poll(() => existsSync(readyPath), { timeout: 30_000 }).toBe(true);
            });
        });
    });

    it("reports a signal handler's error from an MCP click like one from a real click, but not a misused tool", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { GtkButton } from "@gtkx/jsx/gtk";
            export const Content = () => (
                <GtkButton label="Save" onClicked={() => { throw new Error("Saving the card failed"); }} />
            );`,
        );
        await withMcpClient(project.root, async (client) => {
            const session = spawn(
                process.execPath,
                [join(project.root, "node_modules/@gtkx/cli/bin/gtkx.js"), "dev", "--headless", "--size", "640x480"],
                {
                    cwd: project.root,
                    env: Object.fromEntries(
                        Object.entries(process.env).filter(
                            ([name]) => !name.startsWith("VITEST") && name !== "DISPLAY",
                        ),
                    ),
                },
            );
            let output = "";
            session.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
            session.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
            const exited = once(session, "exit");
            try {
                await expect.poll(() => existsSync(readyPath), { timeout: 60_000 }).toBe(true);
                const [button] = await queryWidgets(client, { by: "role", value: "button", options: { name: "Save" } });
                const misused = await callTool(client, "gtkx_type", { widgetId: button?.id, text: "typed" });
                expect(misused.isError).toBe(true);
                expect((await callTool(client, "gtkx_click", { widgetId: button?.id })).isError).toBe(true);
                await expect.poll(() => output, { timeout: 10_000 }).toContain("Saving the card failed");
                expect(output).not.toContain(misused.text);
            } finally {
                session.kill("SIGTERM");
                await exited;
            }
        });
    });

    it("names the widget ID a pointer reaches when an MCP click targets a widget it cannot", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
            import { useState } from "react";
            export const Content = () => {
                const [isArchived, setIsArchived] = useState(false);
                return (
                    <GtkButton onClicked={() => setIsArchived(true)}>
                        <GtkBox canTarget={false}>
                            <GtkLabel label={isArchived ? "Archived" : "Archive"} />
                        </GtkBox>
                    </GtkButton>
                );
            };`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [label] = await queryWidgets(client, { by: "text", value: "Archive" });
                const refused = await callTool(client, "gtkx_click", { widgetId: label?.id });
                expect(refused.isError).toBe(true);
                expect(refused.text).toContain("a pointer there lands on <Button");
                const [, widgetId] = /widget ID is "(\d+)"/.exec(refused.text) ?? [];
                expect((await callTool(client, "gtkx_click", { widgetId })).isError).toBe(false);
                expect(await queryWidgets(client, { by: "text", value: "Archived" })).toHaveLength(1);
            });
        });
    });

    it("presses keys through MCP on a widget or the focused widget", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { AdwAlertDialog } from "@gtkx/jsx/adw";
            import { GtkBox, GtkButton, GtkEntry, GtkLabel } from "@gtkx/jsx/gtk";
            import { useState } from "react";
            export const Content = () => {
                const [isOpen, setIsOpen] = useState(false);
                const [name, setName] = useState("");
                const [result, setResult] = useState("Waiting");
                return (
                    <GtkBox>
                        <GtkButton label="New Folder" onClicked={() => setIsOpen(true)} />
                        <GtkLabel label={result} />
                        {isOpen && (
                            <AdwAlertDialog
                                heading="New Folder"
                                defaultResponse="create"
                                closeResponse="cancel"
                                responses={[{ id: "cancel", label: "Cancel" }, { id: "create", label: "Create" }]}
                                onResponse={(id) => {
                                    setResult(id === "create" ? \`Created \${name}\` : "Cancelled");
                                    setIsOpen(false);
                                }}
                            >
                                <GtkEntry
                                    accessibleLabel="Folder name"
                                    activatesDefault
                                    onChanged={(entry) => setName(entry.getText())}
                                />
                            </AdwAlertDialog>
                        )}
                    </GtkBox>
                );
            };`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const openDialog = async () => {
                    const [button] = await queryWidgets(client, {
                        by: "role",
                        value: "button",
                        options: { name: "New Folder" },
                    });
                    await callTool(client, "gtkx_click", { widgetId: button?.id });
                    const [entry] = await queryWidgets(client, {
                        by: "role",
                        value: "text_box",
                        options: { name: "Folder name" },
                    });
                    return entry?.id;
                };
                const entryId = await openDialog();
                await callTool(client, "gtkx_type", { widgetId: entryId, text: "Invoices {2026}" });
                expect(
                    (await callTool(client, "gtkx_press_keys", { widgetId: entryId, keys: "{Enter}" })).isError,
                ).toBe(false);
                expect(await queryWidgets(client, { by: "text", value: "Created Invoices {2026}" })).toHaveLength(1);

                await openDialog();
                await callTool(client, "gtkx_press_keys", { keys: "{Escape}" });
                expect(await queryWidgets(client, { by: "text", value: "Cancelled" })).toHaveLength(1);
            });
        });
    });

    it("names the focusable ancestor when MCP keys target a widget that cannot take focus", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { AdwActionRow, AdwEntryRow, AdwPreferencesGroup, AdwSwitchRow } from "@gtkx/jsx/adw";
            import { GtkLabel, GtkMenuButton, GtkPopover, GtkSearchEntry } from "@gtkx/jsx/gtk";
            export const Content = () => (
                <AdwPreferencesGroup headerSuffix={<GtkSearchEntry />}>
                    <AdwEntryRow title="Greeting" />
                    <AdwSwitchRow title="Show counter" />
                    <AdwActionRow
                        title="Due"
                        suffix={<GtkMenuButton label="Set date" popover={<GtkPopover><GtkLabel label="Calendar" /></GtkPopover>} />}
                    />
                </AdwPreferencesGroup>
            );`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [entry] = await queryWidgets(client, {
                    by: "role",
                    value: "text_box",
                    options: { name: "Greeting" },
                });
                await callTool(client, "gtkx_type", { widgetId: entry?.id, text: "Hello" });
                const switches = await queryWidgets(client, {
                    by: "role",
                    value: "switch",
                    options: { name: "Show counter" },
                });
                const row = switches.find((widget) => widget.type !== "Switch");
                const inner = switches.find((widget) => widget.type === "Switch");

                const redirected = await callTool(client, "gtkx_press_keys", { widgetId: inner?.id, keys: "{Space}" });
                expect(redirected.text).toContain("The widget cannot take focus");
                expect(redirected.text).toContain(`press the keys on widget ID "${row?.id}"`);
                expect((await callTool(client, "gtkx_press_keys", { widgetId: row?.id, keys: "{Space}" })).text).toBe(
                    "Pressed keys",
                );
                expect((await callTool(client, "gtkx_press_keys", { widgetId: inner?.id, keys: "{Space}" })).text).toBe(
                    "Pressed keys",
                );
                const [search] = await queryWidgets(client, { by: "role", value: "search_box" });
                expect(
                    (await callTool(client, "gtkx_press_keys", { widgetId: search?.id, keys: "{Enter}" })).text,
                ).toBe("Pressed keys");
                const menus = await queryWidgets(client, {
                    by: "role",
                    value: "button",
                    options: { name: "Set date" },
                });
                const menu = menus.find((widget) => widget.type === "MenuButton");
                expect((await callTool(client, "gtkx_press_keys", { widgetId: menu?.id, keys: "{Enter}" })).text).toBe(
                    "Pressed keys",
                );
                const { text } = await callTool(client, "gtkx_get_widget_props", {
                    widgetId: menu?.id,
                    properties: ["active"],
                    maxDepth: 0,
                });
                expect(
                    (JSON.parse(text) as { properties: { active: { value: boolean } } }).properties.active.value,
                ).toBe(true);
            });
        });
    });

    it("names modifiers MCP keys leave held and refuses to type while they are", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { GtkEntry } from "@gtkx/jsx/gtk";
            export const Content = () => <GtkEntry name="notes" text="Draft" />;`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [entry] = await queryWidgets(client, { by: "name", value: "notes" });
                const text = async () => {
                    const { text: props } = await callTool(client, "gtkx_get_widget_props", {
                        widgetId: entry?.id,
                        properties: ["text"],
                        maxDepth: 0,
                    });
                    return (JSON.parse(props) as { properties: { text: { value: string } } }).properties.text.value;
                };

                const held = await callTool(client, "gtkx_press_keys", { widgetId: entry?.id, keys: "{Control>}" });
                expect(held.text).toContain("Control stays held");
                expect(held.text).toContain("{/Control}");
                const refused = await callTool(client, "gtkx_type", { widgetId: entry?.id, text: "a" });
                expect(refused.isError).toBe(true);
                expect(refused.text).toContain("{/Control}");
                expect(await text()).toBe("Draft");
                expect(
                    (await callTool(client, "gtkx_press_keys", { widgetId: entry?.id, keys: "{/Control}" })).text,
                ).toBe("Pressed keys");
                await callTool(client, "gtkx_type", { widgetId: entry?.id, text: "Final", clear: true });
                expect(await text()).toBe("Final");
            });
        });
    });

    it("picks a color chooser swatch with keys through MCP and says when a click or key did nothing", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { GtkColorChooserWidget } from "@gtkx/jsx/gtk";
            export const Content = () => <GtkColorChooserWidget name="chooser" useAlpha={false} />;`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [chooser] = await queryWidgets(client, { by: "name", value: "chooser" });
                const [red] = await queryWidgets(client, { by: "role", value: "radio", options: { name: "Red" } });
                const color = async () => {
                    const { text } = await callTool(client, "gtkx_get_widget_props", {
                        widgetId: chooser?.id,
                        properties: ["rgba"],
                        maxDepth: 0,
                    });
                    return (JSON.parse(text) as { properties: { rgba: { value: string } } }).properties.rgba.value;
                };
                const click = await callTool(client, "gtkx_click", { widgetId: red?.id });
                expect(click.isError).toBe(false);
                expect(click.text).not.toBe("Clicked");
                expect(await color()).toBe("rgb(255,255,255)");
                const ignored = await callTool(client, "gtkx_press_keys", { widgetId: red?.id, keys: "x" });
                expect(ignored.text).not.toBe("Pressed keys");
                expect((await callTool(client, "gtkx_press_keys", { widgetId: red?.id, keys: "{Space}" })).text).toBe(
                    "Pressed keys",
                );
                expect(await color()).toBe("rgb(224,27,36)");
            });
        });
    });

    it("says an MCP click on the label of a check button or menu item was handled", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { GMenu, GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
            import { GtkBox, GtkCheckButton, GtkLabel, GtkMenuButton } from "@gtkx/jsx/gtk";
            import { useState } from "react";
            export const Content = () => {
                const [picks, setPicks] = useState(0);
                return (
                    <GtkBox
                        actionGroups={
                            <GSimpleActionGroup
                                prefix="menu"
                                actions={<GSimpleAction name="pick" onActivate={() => setPicks((count) => count + 1)} />}
                            />
                        }
                    >
                        <GtkCheckButton name="grid" label="Grid" />
                        <GtkMenuButton name="more" label="More" menuModel={<GMenu items={[{ label: "Pick", action: "menu.pick" }]} />} />
                        <GtkLabel label={\`Picked \${picks}\`} />
                    </GtkBox>
                );
            };`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [grid] = await queryWidgets(client, { by: "name", value: "grid" });
                const [gridLabel] = await queryWidgets(client, { by: "text", value: "Grid" });
                expect(await callTool(client, "gtkx_click", { widgetId: gridLabel?.id })).toEqual({
                    isError: false,
                    text: "Clicked",
                });
                const { text } = await callTool(client, "gtkx_get_widget_props", {
                    widgetId: grid?.id,
                    properties: ["active"],
                    maxDepth: 0,
                });
                expect(JSON.parse(text)).toMatchObject({ properties: { active: { value: true } } });

                const [more] = await queryWidgets(client, { by: "name", value: "more" });
                await callTool(client, "gtkx_click", { widgetId: more?.id });
                const [pickLabel] = await queryWidgets(client, { by: "text", value: "Pick" });
                expect(await callTool(client, "gtkx_click", { widgetId: pickLabel?.id })).toEqual({
                    isError: false,
                    text: "Clicked",
                });
                expect(await queryWidgets(client, { by: "text", value: "Picked 1" })).toHaveLength(1);
            });
        });
    });

    it("presses right and middle pointer buttons through MCP on the gestures listening for them", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import * as Gdk from "@gtkx/gi/gdk";
            import { GtkBox, GtkGestureClick, GtkLabel } from "@gtkx/jsx/gtk";
            import { useState } from "react";
            export const Content = () => {
                const [events, setEvents] = useState<string[]>([]);
                const record = (event: string) => setEvents((previous) => [...previous, event]);
                return (
                    <GtkBox
                        controllers={
                            <>
                                <GtkGestureClick
                                    button={Gdk.BUTTON_SECONDARY}
                                    onPressed={() => record("menu")}
                                    onReleased={() => record("menu released")}
                                />
                                <GtkGestureClick button={Gdk.BUTTON_MIDDLE} onPressed={() => record("paste")} />
                            </>
                        }
                    >
                        <GtkLabel label="Habit" />
                        <GtkLabel label={events.join(", ") || "Idle"} />
                    </GtkBox>
                );
            };`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [habit] = await queryWidgets(client, { by: "text", value: "Habit" });
                expect(await callTool(client, "gtkx_pointer", { widgetId: habit?.id, input: "[MouseRight>]" })).toEqual(
                    { isError: false, text: "Applied [MouseRight>]" },
                );
                expect(await queryWidgets(client, { by: "text", value: "menu" })).toHaveLength(1);
                await callTool(client, "gtkx_pointer", { widgetId: habit?.id, input: "[/MouseRight]" });
                await callTool(client, "gtkx_pointer", { widgetId: habit?.id, input: "[MouseMiddle]" });
                expect(await queryWidgets(client, { by: "text", value: "menu, menu released, paste" })).toHaveLength(1);

                const unknown = await callTool(client, "gtkx_pointer", { widgetId: habit?.id, input: "[MouseBack]" });
                expect(unknown.isError).toBe(true);
                expect(unknown.text).toContain('Unknown pointer input "[MouseBack]"');
                expect(
                    (await callTool(client, "gtkx_pointer", { widgetId: habit?.id, input: "[MouseRight]", x: 4 }))
                        .isError,
                ).toBe(true);
            });
        });
    });
});
