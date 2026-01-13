import * as Gtk from "@gtkx/ffi/gtk";
import * as WebKit from "@gtkx/ffi/webkit";
import { GtkBox, GtkButton, GtkEntry, WebKitWebView } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./browser.tsx?raw";

const BrowserDemo = () => {
    const webViewRef = useRef<WebKit.WebView>(null);
    const [url, setUrl] = useState("https://eugeniodepalo.github.io/gtkx/");
    const [inputUrl, setInputUrl] = useState(url);

    const navigate = useCallback((targetUrl: string) => {
        if (!webViewRef.current) {
            return;
        }

        let finalUrl = targetUrl.trim();
        if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
            finalUrl = `https://${finalUrl}`;
        }

        webViewRef.current.loadUri(finalUrl);
        setUrl(finalUrl);
    }, []);

    const handleActivate = useCallback(() => {
        navigate(inputUrl);
    }, [navigate, inputUrl]);

    const handleBack = useCallback(() => {
        webViewRef.current?.goBack();
    }, []);

    const handleForward = useCallback(() => {
        webViewRef.current?.goForward();
    }, []);

    const handleReload = useCallback(() => {
        webViewRef.current?.reload();
    }, []);

    const handleLoadChanged = useCallback((_self: WebKit.WebView, loadEvent: WebKit.LoadEvent) => {
        if (loadEvent === WebKit.LoadEvent.COMMITTED) {
            const currentUri = webViewRef.current?.getUri();
            if (currentUri) {
                setInputUrl(currentUri);
                setUrl(currentUri);
            }
        }
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} hexpand vexpand>
            <GtkBox spacing={6}>
                <GtkButton iconName="go-previous-symbolic" onClicked={handleBack} tooltipText="Back" />
                <GtkButton iconName="go-next-symbolic" onClicked={handleForward} tooltipText="Forward" />
                <GtkButton iconName="view-refresh-symbolic" onClicked={handleReload} tooltipText="Reload" />
                <GtkEntry
                    text={inputUrl}
                    hexpand
                    onChanged={(entry) => setInputUrl(entry.getText())}
                    onActivate={handleActivate}
                    placeholderText="Enter URL..."
                />
                <GtkButton label="Go" onClicked={handleActivate} cssClasses={["suggested-action"]} />
            </GtkBox>
            <WebKitWebView ref={webViewRef} hexpand vexpand uri={url} onLoadChanged={handleLoadChanged} />
        </GtkBox>
    );
};

export const browserDemo: Demo = {
    id: "browser",
    title: "Web Browser",
    description: "A simple web browser using WebKitWebView with navigation controls.",
    keywords: ["browser", "webkit", "web", "internet", "WebKitWebView"],
    component: BrowserDemo,
    sourceCode,
};
