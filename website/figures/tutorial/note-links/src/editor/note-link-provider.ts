import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { registerClass } from "@gtkx/runtime";

const OPEN = "[[";

class NoteLinkProposalBase
    extends GObject.Object
    implements GtkSource.CompletionProposalImpl
{
    name = "";

    vfuncGetTypedText(): string {
        return this.name;
    }
}

const NoteLinkProposal = registerClass(NoteLinkProposalBase, {
    typeName: "NotesNoteLinkProposal",
    implements: [GtkSource.CompletionProposal],
});

type NoteLinkProposal = InstanceType<typeof NoteLinkProposal>;

const openLinkAt = (
    iter: Gtk.TextIter,
): { start: Gtk.TextIter; query: string } | null => {
    const start = iter.copy();
    start.setLineOffset(0);
    const before = start.getText(iter);
    const open = before.lastIndexOf(OPEN);
    const query = before.slice(open + OPEN.length);
    if (open === -1 || query.includes("]")) {
        return null;
    }
    start.forwardChars([...before.slice(0, open)].length);

    return { start, query };
};

const escape = (text: string, special: RegExp): string =>
    text.replace(special, "\\$&");

const markdownLink = (name: string): string =>
    `[${escape(name, /[\\[\]]/g)}](<${escape(`${name}.md`, /[\\<>]/g)}>)`;

const proposals = (
    names: readonly string[],
    context: GtkSource.CompletionContext,
): NoteLinkProposal[] => {
    const [, , end] = context.getBounds();
    const query = openLinkAt(end)?.query.toLocaleLowerCase();
    if (query === undefined) {
        return [];
    }
    const rank = (name: string): number =>
        name.toLocaleLowerCase().startsWith(query) ? 0 : 1;

    return names
        .filter((name) => name.toLocaleLowerCase().includes(query))
        .toSorted((a, b) => rank(a) - rank(b) || a.localeCompare(b))
        .map((name) => {
            const proposal = new NoteLinkProposal();
            proposal.name = name;

            return proposal;
        });
};

class NoteLinkProviderBase
    extends GObject.Object
    implements GtkSource.CompletionProviderImpl
{
    noteNames: () => readonly string[] = () => [];

    vfuncIsTrigger(iter: Gtk.TextIter, ch: string): boolean {
        return ch === "[" && openLinkAt(iter)?.query === "";
    }

    vfuncPopulateAsync(
        context: GtkSource.CompletionContext,
        cancellable: Gio.Cancellable | null,
        callback: Gio.AsyncReadyCallback | null,
    ): void {
        const model = Gio.ListStore.new(NoteLinkProposal);
        model.splice(0, 0, proposals(this.noteNames(), context));
        const value = new GObject.Value();
        value.init(Gio.ListStore);
        value.setObject(model);
        Gio.Task.new(this, cancellable, callback).returnValue(value);
    }

    vfuncPopulateFinish(result: Gio.AsyncResult): Gio.ListModel {
        const [, model] =
            result instanceof Gio.Task
                ? result.propagateValue()
                : [false, null];
        if (!(model instanceof Gio.ListStore)) {
            throw new Error("Completion task returned no model");
        }

        return model;
    }

    vfuncRefilter(
        context: GtkSource.CompletionContext,
        model: Gio.ListModel,
    ): void {
        if (model instanceof Gio.ListStore) {
            model.splice(
                0,
                model.getNItems(),
                proposals(this.noteNames(), context),
            );
        }
    }

    vfuncDisplay(
        _context: GtkSource.CompletionContext,
        proposal: GtkSource.CompletionProposal,
        cell: GtkSource.CompletionCell,
    ): void {
        if (!(proposal instanceof NoteLinkProposal)) {
            return;
        }
        switch (cell.getColumn()) {
            case GtkSource.CompletionColumn.ICON:
                cell.setIconName("text-x-generic-symbolic");
                break;
            case GtkSource.CompletionColumn.TYPED_TEXT:
                cell.setText(proposal.name);
                break;
        }
    }

    vfuncActivate(
        context: GtkSource.CompletionContext,
        proposal: GtkSource.CompletionProposal,
    ): void {
        const buffer = context.getBuffer();
        const [, , end] = context.getBounds();
        const link = openLinkAt(end);
        if (
            buffer === null ||
            link === null ||
            !(proposal instanceof NoteLinkProposal)
        ) {
            return;
        }
        buffer.beginUserAction();
        buffer.delete(link.start, end);
        buffer.insert(link.start, markdownLink(proposal.name), -1);
        buffer.endUserAction();
    }
}

const NoteLinkProvider = registerClass(NoteLinkProviderBase, {
    typeName: "NotesNoteLinkProvider",
    implements: [GtkSource.CompletionProvider],
});

type NoteLinkProvider = InstanceType<typeof NoteLinkProvider>;

export { NoteLinkProvider };
