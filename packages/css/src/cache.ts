import type { EmotionCache } from "@emotion/cache";
import createCache from "@emotion/cache";
import { StyleSheet } from "./style-sheet.js";

let gtkCache: EmotionCache | null = null;

export const getGtkCache = (): EmotionCache => {
    if (!gtkCache) {
        gtkCache = createCache({
            key: "gtkx",
            container: null,
        });

        gtkCache.sheet = createGtkSheet();
    }

    return gtkCache;
};

/**
 * Builds the GTK style sheet Emotion's cache writes generated CSS into.
 *
 * `EmotionCache.sheet` is typed as the DOM-coupled `@emotion/sheet`
 * `StyleSheet`, whose `HTMLStyleElement`/`Node` members have no GTK
 * equivalent. The local {@link StyleSheet} is a deliberate DOM-free
 * reimplementation exposing the `key`/`insert`/`flush`/`hydrate` surface the
 * cache actually invokes; the `unknown` hop is the single boundary bridging
 * that drop-in to the third-party type.
 */
const createGtkSheet = (): EmotionCache["sheet"] => {
    const sheet: unknown = new StyleSheet({ key: "gtkx" });
    return sheet as EmotionCache["sheet"];
};
