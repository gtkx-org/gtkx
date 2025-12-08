import type * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { type ItemContainer, isItemContainer } from "../container-interfaces.js";
import type { Props } from "../factory.js";
import { Node } from "../node.js";

type ItemLabelFn = (item: unknown) => string;

class DropDownStore {
    private stringList: Gtk.StringList;
    private items: unknown[] = [];
    private labelFn: ItemLabelFn;

    constructor(labelFn: ItemLabelFn) {
        this.stringList = new Gtk.StringList([]);
        this.labelFn = labelFn;
    }

    getModel(): Gtk.StringList {
        return this.stringList;
    }

    append(item: unknown): void {
        const label = this.labelFn(item);
        this.stringList.append(label);
        this.items.push(item);
    }

    remove(item: unknown): void {
        const index = this.items.indexOf(item);

        if (index !== -1) {
            this.stringList.remove(index);
            this.items.splice(index, 1);
        }
    }

    getItem(index: number): unknown {
        return this.items[index];
    }

    get length(): number {
        return this.items.length;
    }
}

export class DropDownNode extends Node<Gtk.DropDown> implements ItemContainer<unknown> {
    static matches(type: string): boolean {
        return type === "DropDown.Root";
    }

    private store: DropDownStore;
    private onSelectionChanged?: (item: unknown, index: number) => void;

    constructor(type: string, props: Props) {
        super(type, props);

        const labelFn = (props.itemLabel as ItemLabelFn) ?? ((item: unknown) => String(item));
        this.onSelectionChanged = props.onSelectionChanged as ((item: unknown, index: number) => void) | undefined;
        this.store = new DropDownStore(labelFn);
        this.widget.setModel(this.store.getModel() as unknown as Gio.ListModel);

        if (this.onSelectionChanged) {
            const handler = () => {
                const index = this.widget.getSelected();
                const item = this.store.getItem(index);
                this.onSelectionChanged?.(item, index);
            };

            this.connectSignal(this.widget, "notify::selected", handler);
        }
    }

    addItem(item: unknown): void {
        this.store.append(item);
    }

    insertItemBefore(item: unknown, _beforeItem: unknown): void {
        // DropDown doesn't support ordered insertion
        this.store.append(item);
    }

    removeItem(item: unknown): void {
        this.store.remove(item);
    }

    protected override consumedProps(): Set<string> {
        const consumed = super.consumedProps();
        consumed.add("itemLabel");
        consumed.add("onSelectionChanged");
        return consumed;
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        if (oldProps.onSelectionChanged !== newProps.onSelectionChanged) {
            this.onSelectionChanged = newProps.onSelectionChanged as
                | ((item: unknown, index: number) => void)
                | undefined;
        }

        super.updateProps(oldProps, newProps);
    }
}

export class DropDownItemNode extends Node<never> {
    static matches(type: string): boolean {
        return type === "DropDown.Item";
    }

    protected override isVirtual(): boolean {
        return true;
    }

    private item: unknown;

    constructor(type: string, props: Props) {
        super(type, props);
        this.item = props.item;
    }

    getItem() {
        return this.item;
    }

    override attachToParent(parent: Node): void {
        if (!isItemContainer(parent)) return;
        parent.addItem(this.item);
    }

    override detachFromParent(parent: Node): void {
        if (!isItemContainer(parent)) return;
        parent.removeItem(this.item);
    }
}
