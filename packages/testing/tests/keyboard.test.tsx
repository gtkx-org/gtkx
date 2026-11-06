import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { AdwDialog } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkButton,
    GtkCallbackAction,
    GtkCheckButton,
    GtkColorChooserWidget,
    GtkComboBoxText,
    GtkEntry,
    GtkEventControllerKey,
    GtkFileChooserWidget,
    GtkLabel,
    GtkMenuButton,
    GtkPopover,
    GtkSearchBar,
    GtkSearchEntry,
    GtkShortcut,
    GtkShortcutController,
    GtkStack,
    GtkStackPage,
    GtkSwitch,
    GtkTextView,
    GtkTreeView,
} from "@gtkx/jsx/gtk";
import { GtkSourceView } from "@gtkx/jsx/gtksource";
import { WebKitWebView } from "@gtkx/jsx/webkit";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const CRITICAL_DOMAINS = ["Gtk", "Gdk"];

const collectCriticals = async (run: () => Promise<void>): Promise<string[]> => {
    const criticals: string[] = [];
    const handlers = CRITICAL_DOMAINS.map((domain) =>
        GLib.logSetHandler(domain, GLib.LogLevelFlags.LEVEL_CRITICAL, (_domain, _level, message) => {
            criticals.push(message);
        }),
    );

    try {
        await run();
    } finally {
        for (const [index, domain] of CRITICAL_DOMAINS.entries()) {
            GLib.logRemoveHandler(domain, handlers[index] ?? 0);
        }
    }

    return criticals;
};

describe("Unicode keyboard input", () => {
    it.each(["a", "é", "λ", "🚀", "Aλ🚀Z"])("delivers each character of %s once", async (input) => {
        const pressed: number[] = [];
        const released: number[] = [];

        await render(
            <GtkBox
                name="keys"
                controllers={
                    <GtkEventControllerKey
                        onKeyPressed={(keyval) => {
                            pressed.push(Gdk.keyvalToUnicode(keyval));

                            return Gdk.EVENT_STOP;
                        }}
                        onKeyReleased={(keyval) => {
                            released.push(Gdk.keyvalToUnicode(keyval));
                        }}
                    />
                }
            />,
        );

        await userEvent.keyboard(screen.getByName("keys"), input);
        const expected = Array.from(input, (character) => character.codePointAt(0));
        expect(pressed).toEqual(expected);
        expect(released).toEqual(expected);
    });

    it("presses and holds a character key named in braces", async () => {
        const events: string[] = [];

        await render(
            <GtkBox
                name="keys"
                controllers={
                    <GtkEventControllerKey
                        onKeyPressed={(keyval) => {
                            events.push(`+${String.fromCodePoint(Gdk.keyvalToUnicode(keyval))}`);

                            return Gdk.EVENT_STOP;
                        }}
                        onKeyReleased={(keyval) => {
                            events.push(`-${String.fromCodePoint(Gdk.keyvalToUnicode(keyval))}`);
                        }}
                    />
                }
            />,
        );

        await userEvent.keyboard(screen.getByName("keys"), "{=}{a>}b{/a}");
        expect(events).toEqual(["+=", "-=", "+a", "+b", "-b", "-a"]);
    });
});

describe("keyboard mnemonics", () => {
    it.each(["{Alt>}r{/Alt}", "{Alt>}R{/Alt}", "{Alt>}{Shift>}r{/Shift}{/Alt}"])(
        "activates a native label's parent with %s",
        async (input) => {
            await render(
                <GtkBox>
                    <GtkEntry name="source" />
                    <GtkCheckButton name="remember">
                        <GtkLabel label="_Remember" useUnderline />
                    </GtkCheckButton>
                </GtkBox>,
            );

            const source = screen.getByName("source");
            await userEvent.click(source);
            await userEvent.keyboard(source, input);
            expect(screen.getByName("remember")).toBeChecked();
        },
    );

    it.each(["r", "{Control>}r{/Control}", "{Alt>}{Control>}r{/Control}{/Alt}", "{Alt>}x{/Alt}"])(
        "ignores a mnemonic when its key or modifiers do not match: %s",
        async (input) => {
            await render(
                <GtkBox>
                    <GtkEntry name="source" />
                    <GtkCheckButton name="remember" label="_Remember" useUnderline />
                </GtkBox>,
            );

            await userEvent.keyboard(screen.getByName("source"), input);
            expect(screen.getByName("remember")).not.toBeChecked();
        },
    );

    it("ignores hidden and insensitive mnemonic targets", async () => {
        await render(
            <GtkBox>
                <GtkEntry name="source" />
                <GtkCheckButton name="remember" label="_Remember" useUnderline />
                <GtkCheckButton name="disabled" label="_Remember disabled" useUnderline sensitive={false} />
                <GtkCheckButton label="_Remember hidden" useUnderline visible={false} />
            </GtkBox>,
        );

        await userEvent.keyboard(screen.getByName("source"), "{Alt>}r{/Alt}");
        expect(screen.getByName("remember")).toBeChecked();
        expect(screen.getByName("disabled")).not.toBeChecked();
    });

    it("cycles focus between duplicate mnemonics without activating either target", async () => {
        await render(
            <GtkBox>
                <GtkEntry name="source" />
                <GtkCheckButton name="first" label="_Remember first" useUnderline />
                <GtkCheckButton name="second" label="_Remember second" useUnderline />
            </GtkBox>,
        );

        const source = screen.getByName("source");
        await userEvent.click(source);
        await userEvent.keyboard(source, "{Alt>}r{/Alt}");
        const first = screen.getByName("first");
        const second = screen.getByName("second");
        const focused = first.hasFocus() ? first : second;
        const next = focused === first ? second : first;
        expect(focused).toHaveFocus();

        await userEvent.keyboard(source, "{Alt>}r{/Alt}");
        expect(next).toHaveFocus();
        await userEvent.keyboard(source, "{Alt>}r{/Alt}");
        expect(focused).toHaveFocus();
        expect(first).not.toBeChecked();
        expect(second).not.toBeChecked();
    });

    it("uses a shortcut controller's configured mnemonic modifier", async () => {
        await render(
            <GtkCheckButton
                name="remember"
                label="Remember"
                controllers={
                    <GtkShortcutController
                        mnemonicModifiers={Gdk.ModifierType.CONTROL_MASK}
                        shortcuts={
                            <GtkShortcut
                                trigger={new Gtk.MnemonicTrigger({ keyval: Gdk.KEY_r })}
                                action={Gtk.MnemonicAction.get()}
                            />
                        }
                    />
                }
            />,
        );

        const target = screen.getByName("remember");
        await userEvent.keyboard(target, "{Alt>}r{/Alt}");
        expect(target).not.toBeChecked();
        await userEvent.keyboard(target, "{Control>}r{/Control}");
        expect(target).toBeChecked();
    });

    it("rejects an unknown key without leaving the mnemonic modifier held", async () => {
        await render(<GtkCheckButton name="remember" label="_Remember" useUnderline />);

        const user = userEvent.setup();
        const target = screen.getByName("remember");
        await expect(user.keyboard(target, "{Alt>}{Unknown}{/Alt}")).rejects.toThrow();
        await user.keyboard(target, "r");
        expect(target).not.toBeChecked();
    });
});

describe("keyboard focus movement", () => {
    it("moves focus with Tab, Shift+Tab and arrow keys as the window's bindings do", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkEntry name="name" />
                <GtkCheckButton name="subscribe" label="Subscribe" />
                <GtkButton name="submit" label="Submit" />
            </GtkBox>,
        );

        const name = screen.getByName("name");
        const subscribe = screen.getByName("subscribe");
        const submit = screen.getByName("submit");
        await userEvent.click(name);
        await userEvent.keyboard(name, "{Tab}");
        expect(subscribe).toHaveFocus();
        await userEvent.keyboard(subscribe, "{Tab}");
        expect(submit).toHaveFocus();
        await userEvent.keyboard(submit, "{Shift>}{Tab}{/Shift}");
        expect(subscribe).toHaveFocus();
        await userEvent.keyboard(subscribe, "{ArrowDown}");
        expect(submit).toHaveFocus();
        await userEvent.keyboard(submit, "{ArrowUp}");
        expect(subscribe).toHaveFocus();
    });

    it("follows focus through one key sequence on a common ancestor", async () => {
        await render(
            <GtkBox name="form" orientation={Gtk.Orientation.VERTICAL}>
                <GtkEntry name="first" />
                <GtkEntry name="second" />
                <GtkEntry name="third" />
            </GtkBox>,
        );

        await userEvent.click(screen.getByName("first"));
        await userEvent.keyboard(screen.getByName("form"), "{Tab}{Tab}");
        expect(screen.getByName("third")).toHaveFocus();
    });

    it("sends keys without a target to the focused widget of the active window", async () => {
        const activated: string[] = [];

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkEntry name="first" onActivate={() => activated.push("first")} />
                <GtkEntry name="second" onActivate={() => activated.push("second")} />
            </GtkBox>,
        );

        await userEvent.click(screen.getByName("first"));
        await userEvent.keyboard("{Tab}{Enter}");
        expect(screen.getByName("second")).toHaveFocus();
        expect(activated).toEqual(["second"]);
    });

    it("sends keys without a target to the window when its focus widget is not mapped", async () => {
        let created = 0;
        const closedRef = createRef<Gtk.Button>();

        await render(
            <GtkBox
                controllers={
                    <GtkShortcutController
                        scope={Gtk.ShortcutScope.MANAGED}
                        shortcuts={
                            <GtkShortcut
                                trigger={Gtk.ShortcutTrigger.parseString("<Control>n")}
                                action={
                                    <GtkCallbackAction
                                        callback={() => {
                                            created++;

                                            return true;
                                        }}
                                    />
                                }
                            />
                        }
                    />
                }
            >
                <GtkStack>
                    <GtkStackPage name="shown">
                        <GtkButton label="Shown" />
                    </GtkStackPage>
                    <GtkStackPage name="closed">
                        <GtkButton ref={closedRef} label="Closed" />
                    </GtkStackPage>
                </GtkStack>
            </GtkBox>,
        );

        const closed = closedRef.current;
        const window = closed?.getRoot();
        expect(window).toBeInstanceOf(Gtk.Window);
        if (window instanceof Gtk.Window) window.setFocus(closed ?? null);
        await userEvent.keyboard("{Control>}n{/Control}");
        expect(created).toBe(1);
    });

    it("sends later keys of one sequence to the widget focus moved to outside the target", async () => {
        const activated: string[] = [];

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton name="first" label="First" onClicked={() => activated.push("first")} />
                <GtkButton name="second" label="Second" onClicked={() => activated.push("second")} />
            </GtkBox>,
        );

        const first = screen.getByName("first");
        first.grabFocus();
        await userEvent.keyboard(first, "{ArrowDown}{Enter}");
        expect(screen.getByName("second")).toHaveFocus();
        expect(activated).toEqual(["second"]);
    });

    it.each(["{Enter}", "{Space}"])("clicks a focused button when %s is released", async (input) => {
        let clicks = 0;

        await render(
            <GtkButton
                name="apply"
                label="Apply"
                onClicked={() => {
                    clicks++;
                }}
            />,
        );

        const apply = screen.getByName("apply");
        apply.grabFocus();
        await userEvent.keyboard(apply, input);
        expect(clicks).toBe(1);
    });

    it.each(["{Enter}", "{Space}"])(
        "activates the target rather than the window's focus widget when %s is pressed",
        async (input) => {
            const activated: string[] = [];

            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkEntry name="greeting" onActivate={() => activated.push("greeting")} />
                    <GtkSwitch name="toggle" />
                </GtkBox>,
            );

            await userEvent.click(screen.getByName("greeting"));
            const toggle = screen.getByName("toggle");
            await userEvent.keyboard(toggle, input);
            expect(toggle).toHaveFocus();
            expect(toggle instanceof Gtk.Switch && toggle.getActive()).toBe(true);
            expect(activated).toEqual([]);
        },
    );

    it("focuses an entry that delegates its focus to its text before pressing keys", async () => {
        const activated: string[] = [];

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkSearchEntry name="search" text="Ada" onActivate={() => activated.push("search")} />
                <GtkButton name="other" label="Other" onClicked={() => activated.push("other")} />
            </GtkBox>,
        );

        screen.getByName("other").grabFocus();
        const search = screen.getByName("search");
        await userEvent.keyboard(search, "{Enter}");
        expect(search).toHaveFocus();
        expect(activated).toEqual(["search"]);
    });

    it("opens a menu button that passes its focus to its button when Enter is pressed on it", async () => {
        const activated: string[] = [];

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton name="other" label="Other" onClicked={() => activated.push("other")} />
                <GtkMenuButton
                    name="due"
                    label="Set date"
                    popover={
                        <GtkPopover>
                            <GtkLabel label="Calendar" />
                        </GtkPopover>
                    }
                />
            </GtkBox>,
        );

        screen.getByName("other").grabFocus();
        const due = screen.getByName("due", { as: Gtk.MenuButton });
        await userEvent.keyboard(due, "{Enter}");
        expect(due.getActive()).toBe(true);
        expect(activated).toEqual([]);
    });

    it("keeps a text view's Tab and Return as text instead of moving focus", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkTextView name="notes" />
                <GtkButton name="after" label="After" />
            </GtkBox>,
        );

        const notes = screen.getByName("notes", { as: Gtk.TextView });
        await userEvent.click(notes);
        await userEvent.keyboard(notes, "{Tab}{Enter}");
        const buffer = notes.getBuffer();
        expect(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), true)).toBe("\t\n");
        expect(notes).toHaveFocus();
    });

    it("presses keys in a source view like a text view, without key controllers that need a real event", async () => {
        const criticals = await collectCriticals(async () => {
            await render(<GtkSourceView name="code" />);
            const code = screen.getByName("code", { as: GtkSource.View });
            await userEvent.click(code);
            await userEvent.keyboard(code, "{Tab}{Control>}{/Control}{Enter}");
            const buffer = code.getBuffer();
            expect(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), true)).toBe("\t\n");
        });

        expect(criticals).toEqual([]);
    });
});

describe("keyboard on GTK's own widgets", () => {
    it.each(["{Space}", "{Enter}"])("selects a color chooser swatch with %s", async (input) => {
        await render(<GtkColorChooserWidget name="chooser" useAlpha={false} />);

        const chooser = screen.getByName("chooser", { as: Gtk.ColorChooserWidget });
        await userEvent.keyboard(screen.getByRole(Gtk.AccessibleRole.RADIO, { name: "Red" }), input);
        expect(chooser.getRgba().toString()).toBe("rgb(224,27,36)");
    });

    it("keeps keys from a search entry's capture widget without a real event", async () => {
        const criticals = await collectCriticals(async () => {
            await render(
                <GtkBox name="page" orientation={Gtk.Orientation.VERTICAL}>
                    <GtkSearchEntry name="search" />
                    <GtkButton name="other" label="Other" />
                </GtkBox>,
            );
            screen
                .getByName("search", { as: Gtk.SearchEntry })
                .setKeyCaptureWidget(screen.getByName("page", { as: Gtk.Box }));
            await userEvent.keyboard(screen.getByName("other"), "a");
        });

        expect(criticals).toEqual([]);
    });

    it("keeps keys from a search bar's capture widget without a real event", async () => {
        const search = createRef<Gtk.SearchEntry>();
        const criticals = await collectCriticals(async () => {
            await render(
                <GtkBox name="page" orientation={Gtk.Orientation.VERTICAL}>
                    <GtkSearchBar name="bar">
                        <GtkSearchEntry ref={search} />
                    </GtkSearchBar>
                    <GtkButton name="other" label="Other" />
                </GtkBox>,
            );
            const bar = screen.getByName("bar", { as: Gtk.SearchBar });
            expect(search.current).toBeInstanceOf(Gtk.SearchEntry);
            if (search.current) bar.connectEntry(search.current);
            bar.setKeyCaptureWidget(screen.getByName("page", { as: Gtk.Box }));
            await userEvent.keyboard(screen.getByName("other"), "a");
        });

        expect(criticals).toEqual([]);
    });

    it("presses keys in a file chooser without its key forwarding", async () => {
        const criticals = await collectCriticals(async () => {
            await render(<GtkFileChooserWidget name="files" />);
            await userEvent.keyboard(screen.getByName("files"), "a");
        });

        expect(criticals).toEqual([]);
    });

    it("presses keys in a combo box's popup without its key forwarding", async () => {
        const criticals = await collectCriticals(async () => {
            await render(<GtkComboBoxText name="size" />);
            const size = screen.getByName("size", { as: Gtk.ComboBoxText });
            size.appendText("Small");
            size.appendText("Large");
            size.popup();
            const popup = size.getLastChild();
            expect(popup).toBeInstanceOf(Gtk.Popover);
            if (popup) await userEvent.keyboard(popup, "{ArrowUp}");
        });

        expect(criticals).toEqual([]);
    });

    it("presses keys in a web view without its key handling, which needs a real event", async () => {
        const criticals = await collectCriticals(async () => {
            await render(<WebKitWebView name="page" />);
            await userEvent.keyboard(screen.getByName("page"), "a");
        });

        expect(criticals).toEqual([]);
    });

    it("presses keys in a tree view without its interactive search forwarding", async () => {
        const criticals = await collectCriticals(async () => {
            await render(<GtkTreeView name="tree" />);
            const tree = screen.getByName("tree");
            tree.grabFocus();
            await userEvent.keyboard(tree, "a");
        });

        expect(criticals).toEqual([]);
    });
});

describe("keyboard in popovers", () => {
    it("closes an open popover with Escape before an enclosing dialog handles it", async () => {
        let closedDialogs = 0;

        await render(
            <AdwDialog
                title="Edit"
                onClosed={() => {
                    closedDialogs++;
                }}
            >
                <GtkMenuButton
                    label="Color"
                    popover={
                        <GtkPopover>
                            <GtkButton name="blue" label="Blue" />
                        </GtkPopover>
                    }
                />
            </AdwDialog>,
        );

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Color" }));
        const blue = await screen.findByName("blue");
        await userEvent.keyboard(blue, "{Escape}");
        expect(blue).not.toBeVisible();
        expect(screen.getByRole(Gtk.AccessibleRole.DIALOG, { name: "Edit" })).toBeVisible();
        expect(closedDialogs).toBe(0);
    });
});
