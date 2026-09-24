import { useData } from "vitepress";
import { computed, type ComputedRef } from "vue";
import {
    documentationLink,
    type DocumentationVersion,
    GUIDE_ROOT,
    rootVersion,
    type VersionLink,
    versions,
} from "../../versioning.js";

type VersionContext = {
    version: ComputedRef<DocumentationVersion>;
    link: (target: DocumentationVersion) => string;
    isSamePage: (target: DocumentationVersion) => boolean;
};

type DocumentationFrontmatter = {
    versionId?: string;
    versionLinks?: Record<string, VersionLink>;
};

const useDocumentationVersion = (): VersionContext => {
    const { frontmatter } = useData();
    const documentation = computed<DocumentationFrontmatter>(() => frontmatter.value);
    const links = computed(() => new Map(Object.entries(documentation.value.versionLinks ?? {})));
    const version = computed(
        () => versions.find((entry) => entry.id === documentation.value.versionId) ?? rootVersion,
    );

    return {
        version,
        link: (target) => links.value.get(target.id)?.href ?? documentationLink(target, GUIDE_ROOT),
        isSamePage: (target) => links.value.get(target.id)?.samePage ?? false,
    };
};

export { useDocumentationVersion };
