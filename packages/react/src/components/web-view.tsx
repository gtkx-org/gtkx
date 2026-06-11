import type * as WebKit from "@gtkx/gi/webkit";
import type { WebKitWebViewProps } from "@gtkx/jsx/webkit";
import { type ReactNode, useRef } from "react";
import { createWidgetComponent } from "../create-widget-component.js";
import { useMergedRefs } from "../use-merged-refs.js";
import { useSignal } from "../use-signal.js";

const WebKitWebViewElement = createWidgetComponent<Omit<WebKitWebViewProps, "onLoadChanged">>("WebKitWebView");

/**
 * Declarative wrapper for `WebKit.WebView`.
 *
 * The `onLoadChanged` callback fires on every load-state transition and receives
 * the `WebKit.LoadEvent` and the backing `WebKit.WebView`. The handler is wired
 * through a direct `load-changed` connection so it keeps firing during a React
 * commit, when blockable signal handlers are suppressed. The latest callback is
 * read on each event, so changing `onLoadChanged` never reconnects the signal.
 * All other props forward to the underlying widget.
 *
 * @example
 * ```tsx
 * <WebKitWebView
 *   onLoadChanged={(loadEvent, webView) => {
 *     if (loadEvent === WebKit.LoadEvent.FINISHED) console.log(webView.getUri());
 *   }}
 * />
 * ```
 *
 * @param props - {@link WebKitWebViewProps}, including the `onLoadChanged` callback.
 */
export const WebKitWebView = ({ onLoadChanged, ref, children, ...rest }: WebKitWebViewProps): ReactNode => {
    const viewRef = useRef<WebKit.WebView | null>(null);
    const mergedRef = useMergedRefs(viewRef, ref);

    useSignal(viewRef, "load-changed", (loadEvent: WebKit.LoadEvent) => {
        const view = viewRef.current;
        if (view) onLoadChanged?.(loadEvent, view);
    });

    return (
        <WebKitWebViewElement ref={mergedRef} {...rest}>
            {children}
        </WebKitWebViewElement>
    );
};
