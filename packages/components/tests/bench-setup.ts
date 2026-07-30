import type { ColumnViewColumnConstructorProps, LabelConstructorProps } from "@gtkx/gi/gtk";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass, registerWrapperClass } from "@gtkx/runtime";

type InscriptionProps = LabelConstructorProps & { text?: string | null | undefined };

const INSCRIPTION_SINCE_MINOR = 8;
const COLUMN_ID_SINCE_MINOR = 10;
const gtkMinor = Gtk.getMinorVersion();
const columnIds: WeakMap<object, string> = new WeakMap();

class InscriptionFallback extends Gtk.Label {
    constructor({ text, ...rest }: InscriptionProps = {}) {
        super(rest);

        if (text !== undefined) {
            this.text = text;
        }
    }

    get text(): string | null {
        return this.getLabel();
    }

    set text(value: string | null) {
        this.setLabel(value ?? "");
    }
}

class ColumnViewColumnFallback extends Gtk.ColumnViewColumn {
    constructor({ id, ...rest }: ColumnViewColumnConstructorProps = {}) {
        super(rest);

        if (id !== undefined) {
            this.setId(id);
        }
    }

    override getId(): string | null {
        return columnIds.get(this) ?? null;
    }

    override setId(id: string | null): void {
        if (id === null) {
            columnIds.delete(this);

            return;
        }

        columnIds.set(this, id);
    }
}

if (gtkMinor < INSCRIPTION_SINCE_MINOR) {
    registerClass(InscriptionFallback, { typeName: "GtkInscription" });
}

if (gtkMinor < COLUMN_ID_SINCE_MINOR) {
    registerWrapperClass(ColumnViewColumnFallback, Gtk.ColumnViewColumn.prototype.__type__);
}
