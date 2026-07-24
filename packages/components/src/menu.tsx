import * as Gio from "@gtkx/gi/gio";
import { GMenu } from "@gtkx/jsx/gio";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { MenuEntry, MenuProps } from "./types.js";

type EntryShape = [string | null, string | null, EntryShape[] | null, EntryShape[] | null];

const entryShape = (entry: MenuEntry): EntryShape => [
    entry.label ?? null,
    entry.action ?? null,
    entry.submenu?.map(entryShape) ?? null,
    entry.section?.map(entryShape) ?? null,
];

const signatureOf = (entries: MenuEntry[]): string => JSON.stringify(entries.map(entryShape));

const appendEntry = (model: Gio.Menu, entry: MenuEntry): void => {
    if (entry.submenu !== undefined) model.appendSubmenu(entry.label ?? null, toModel(entry.submenu));
    else if (entry.section !== undefined) model.appendSection(entry.label ?? null, toModel(entry.section));
    else model.append(entry.label ?? null, entry.action ?? null);
};

const toModel = (entries: MenuEntry[]): Gio.Menu => {
    const model = new Gio.Menu({});
    for (const entry of entries) appendEntry(model, entry);
    return model;
};

/** Builds a Gio.Menu model from a declarative array of menu entries. */
export function Menu(props: MenuProps): ReactNode {
    const { items, ref, ...rest } = props;
    const [menu, refCallback] = useWidgetRef<Gio.Menu>(ref);
    const lastFill = useRef<{ target: Gio.Menu; signature: string } | null>(null);
    useLayoutEffect(() => {
        if (menu === null) return;
        const entries = items ?? [];
        const signature = signatureOf(entries);
        if (lastFill.current?.target === menu && lastFill.current.signature === signature) return;
        lastFill.current = { target: menu, signature };
        menu.removeAll();
        for (const entry of entries) appendEntry(menu, entry);
    }, [menu, items]);
    return <GMenu ref={refCallback} {...rest} />;
}
