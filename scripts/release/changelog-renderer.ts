import changelogRenderer from "nx/release/changelog-renderer";

const { default: DefaultChangelogRenderer } = changelogRenderer;

const UPGRADE_NOTES: Record<string, string> = {
    "2.0.0":
        "GTKX 2.0 is stable. The [announcement](https://gtkx.dev/blog/gtkx-2-0) covers what changed since 1.6, the beta entries below list each change, and the [upgrade guide](https://gtkx.dev/guide/upgrading-to-2) shows how to migrate from 1.x.",
};

/**
 * Nx release changelog renderer for `CHANGELOG.md`.
 *
 * Extends the default renderer so each entry lists breaking changes before features and fixes,
 * and opens releases that have an upgrade guide with a note linking to it. A release that has such a
 * note and no changes of its own, as a stable release cut straight from its last prerelease does,
 * shows the note alone instead of Nx's "version bump only" text.
 */
export default class ChangelogRenderer extends DefaultChangelogRenderer {
    override async render(): Promise<string> {
        this.preprocessChanges();

        if (this.shouldRenderEmptyEntry()) {
            return this.renderEmptyEntry();
        }

        const changesByType = this.renderChangesByType();
        const sections = [
            [this.renderVersionTitle()],
            this.hasBreakingChanges() ? this.renderBreakingChanges() : [],
            changesByType,
            this.hasDependencyBumps() ? this.renderDependencyBumps() : [],
            this.shouldRenderAuthors() ? await this.renderAuthors() : [],
        ];

        return sections
            .filter((section) => section.length > 0)
            .map((section) => section.join("\n").trim())
            .join("\n\n")
            .trim();
    }

    protected override renderEmptyEntry(): string {
        return UPGRADE_NOTES[this.changelogEntryVersion] === undefined
            ? super.renderEmptyEntry()
            : this.renderVersionTitle();
    }

    protected override renderVersionTitle(): string {
        const title = super.renderVersionTitle();
        const note = UPGRADE_NOTES[this.changelogEntryVersion];

        return note === undefined ? title : `${title}\n\n${note}`;
    }
}
