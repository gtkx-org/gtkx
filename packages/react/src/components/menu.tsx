import type * as Gio from "@gtkx/gi/gio";
import { createContext, type ReactNode, type Ref, useContext, useMemo } from "react";
import type { MenuItemProps, MenuProps, MenuSectionProps, MenuSubmenuProps } from "../jsx.js";
import { ApplicationContext } from "../render.js";
import type { MenuActionContext, MenuEntry } from "./internal/menu-model.js";

const GMenuElement = "GMenu" as const;

/**
 * The ordered {@link MenuEntry} list one menu level appends to. A fresh array is
 * created per render pass; markers append their entry as they render, so the
 * order matches the React tree order.
 */
type MenuCollector = MenuEntry[];

const MenuCollectorContext = createContext<MenuCollector | null>(null);

const useCollector = (): MenuCollector | null => useContext(MenuCollectorContext);

/**
 * Renders `children` within a nested collector keyed by `entries`, so markers
 * within them append to `entries` rather than the parent level.
 */
const collectInto = (entries: MenuEntry[], children: ReactNode): ReactNode => (
    <MenuCollectorContext.Provider value={entries}>{children}</MenuCollectorContext.Provider>
);

/**
 * Declares one activatable entry in a {@link Menu}.
 *
 * The item registers a `Gio.SimpleAction` named `<prefix>.<id>` on the menu's
 * action map and invokes `onActivate` when triggered. It contributes its entry to
 * the enclosing {@link Menu} and renders nothing in the widget tree.
 *
 * @param props - The menu item's id, label, activation handler, and accelerators.
 */
export const MenuItem = ({ id, label, onActivate, accels }: MenuItemProps): ReactNode => {
    useCollector()?.push({ type: "item", id, label, onActivate, accels });
    return null;
};

/**
 * Declares a grouping section within a {@link Menu}.
 *
 * Sections separate related items with an optional header label, collecting their
 * own children before contributing a section entry to the enclosing {@link Menu}.
 *
 * @param props - The optional section label and the section's child entries.
 */
export const MenuSection = ({ label, children }: MenuSectionProps): ReactNode => {
    const childEntries = useEntryList(children);
    useCollector()?.push({ type: "section", label, children: childEntries });
    return collectInto(childEntries, children);
};

/**
 * Declares a nested submenu within a {@link Menu}.
 *
 * The submenu collects its own children before contributing a submenu entry to
 * the enclosing {@link Menu}.
 *
 * @param props - The submenu label and its child entries.
 */
export const MenuSubmenu = ({ label, children }: MenuSubmenuProps): ReactNode => {
    const childEntries = useEntryList(children);
    useCollector()?.push({ type: "submenu", label, children: childEntries });
    return collectInto(childEntries, children);
};

/**
 * Allocates one fresh {@link MenuEntry} array keyed by `children`, so a stable
 * child tree reuses the same array while markers append into it during render.
 */
const useEntryList = (children: ReactNode): MenuEntry[] =>
    // biome-ignore lint/correctness/useExhaustiveDependencies: children keys a fresh array per child-tree change
    useMemo<MenuEntry[]>(() => [], [children]);

/**
 * Renders `children` in a hidden collector and returns the {@link MenuEntry} list
 * they declare, expanding custom components before collecting their entries.
 *
 * The returned `scope` must be rendered for the entries to populate; the same
 * `entries` array reference is reused across renders for a stable child tree and
 * is filled in tree order each render. Consumers read `entries` after the
 * children have rendered (e.g. in a commit or the reconciler).
 *
 * @param children - The menu-marker children to collect entries from.
 * @returns The collected entries and the scope node to render.
 */
export const useMenuEntries = (children: ReactNode): { entries: MenuEntry[]; scope: ReactNode } => {
    const entries = useEntryList(children);
    return { entries, scope: collectInto(entries, children) };
};

/**
 * Builds a `Gio.Menu` model from declarative {@link MenuItem}, {@link MenuSection},
 * and {@link MenuSubmenu} children and exposes it through a ref.
 *
 * Children render normally, so custom components that wrap menu entries are
 * expanded by React before their entries are collected. The collected entries
 * are handed to the `GMenu` element, whose reconciler descriptor builds the menu
 * and its `Gio.SimpleAction`s during the commit. Activatable items register a
 * `Gio.SimpleAction` on a widget-local `Gio.SimpleActionGroup` inserted on the
 * host (`menu` prefix) when the menu has a host widget, otherwise on the enclosing
 * application (canonical `app.<id>` namespace), or on the supplied
 * `actionContext`. Accelerators bind on the application when one is in context.
 *
 * The produced `Gio.Menu` is a real GObject; place it in a host's menu slot
 * (`menuModel`, `menubar`, `headerMenu`).
 *
 * @param props - The menu's children, optional ref, and an explicit action
 *   context for callers that own the action map (e.g. a column header menu).
 *
 * @example
 * ```tsx
 * <GtkMenuButton
 *   menuModel={
 *     <Menu>
 *       <MenuItem id="about" label="_About" onActivate={onAbout} />
 *     </Menu>
 *   }
 * />
 * ```
 */
export const Menu = ({
    children,
    ref,
    actionContext,
}: MenuProps & {
    ref?: Ref<Gio.Menu | null>;
    actionContext?: MenuActionContext;
}): ReactNode => {
    const application = useContext(ApplicationContext);
    const { entries, scope } = useMenuEntries(children);
    return (
        <>
            {scope}
            <GMenuElement
                ref={ref}
                menuEntries={entries}
                menuApplication={application}
                menuActionContext={actionContext}
            />
        </>
    );
};
