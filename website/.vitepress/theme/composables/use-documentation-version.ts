import { useRoute } from "vitepress";
import { computed, type ComputedRef } from "vue";
import {
    type DocumentationVersion,
    hasExactCounterpart,
    resolveVersionPath,
    versionForPath,
} from "../../versioning.js";

const routesByVersion: Map<string, Set<string>> = new Map(
    Object.entries(GTKX_VERSION_ROUTES).map(([id, routes]): [string, Set<string>] => [id, new Set(routes)]),
);

const hasPage = (version: DocumentationVersion, path: string): boolean =>
    routesByVersion.get(version.id)?.has(path) ?? false;

type DocumentationVersionContext = {
    version: ComputedRef<DocumentationVersion>;
    resolve: (target: DocumentationVersion) => string;
    hasCounterpart: (target: DocumentationVersion) => boolean;
};

const useDocumentationVersion = (): DocumentationVersionContext => {
    const route = useRoute();

    return {
        version: computed(() => versionForPath(route.path)),
        resolve: (target) => resolveVersionPath(route.path, target, hasPage),
        hasCounterpart: (target) => hasExactCounterpart(route.path, target, hasPage),
    };
};

export { type DocumentationVersionContext, useDocumentationVersion };
