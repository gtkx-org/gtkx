import changelogRenderer from "nx/release/changelog-renderer";

const { default: DefaultChangelogRenderer } = changelogRenderer;

const UPGRADE_NOTES: Record<string, string> = {
    "2.0.0": "Follow the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2) to migrate from 1.x.",
};

/**
 * Nx release changelog renderer for `CHANGELOG.md`.
 *
 * Extends the default renderer so each entry lists breaking changes before features and fixes,
 * and opens releases that have an upgrade guide with a link to it.
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

    protected override renderVersionTitle(): string {
        const title = super.renderVersionTitle();
        const note = UPGRADE_NOTES[this.changelogEntryVersion];

        return note === undefined ? title : `${title}\n\n${note}`;
    }
}
