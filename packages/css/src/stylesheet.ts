import type * as Gtk from "@gtkx/gi/gtk";
import { createLogger } from "@gtkx/utils";
import { attachParsingErrorLogger, registerProviderForDefaultDisplay } from "./provider.js";

const log = createLogger("css");

class StyleSheet {
    private readonly sections: string[][] = [];
    private readonly ownedSections: Map<string, string[]> = new Map();
    private sharedSection: string[] | null = null;
    private provider: Gtk.CssProvider | null = null;
    private updateScheduled = false;

    private ensureProvider(): Gtk.CssProvider {
        if (this.provider) {
            return this.provider;
        }

        const provider = registerProviderForDefaultDisplay();
        this.provider = provider;
        attachParsingErrorLogger(provider, log, "CSS");

        return provider;
    }

    private scheduleUpdate(): void {
        if (this.updateScheduled) {
            return;
        }

        this.updateScheduled = true;

        queueMicrotask(() => {
            this.updateScheduled = false;
            this.ensureProvider().loadFromString(this.sections.flat().join("\n"));
        });
    }

    private appendSection(): string[] {
        const section: string[] = [];
        this.sections.push(section);

        return section;
    }

    private sectionFor(owner: string | undefined): string[] {
        if (owner === undefined) {
            this.sharedSection ??= this.appendSection();

            return this.sharedSection;
        }

        let section = this.ownedSections.get(owner);

        if (section === undefined) {
            section = this.appendSection();
            this.ownedSections.set(owner, section);
            this.sharedSection = null;
        }

        return section;
    }

    insert(rule: string, owner?: string): void {
        this.sectionFor(owner).push(rule);
        this.scheduleUpdate();
    }

    clear(owner: string): void {
        const section = this.ownedSections.get(owner);

        if (section !== undefined) {
            section.length = 0;
            this.scheduleUpdate();
        }
    }
}

export { StyleSheet };
