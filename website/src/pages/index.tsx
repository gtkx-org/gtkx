import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import CodeBlock from "@theme/CodeBlock";
import Layout from "@theme/Layout";
import type { ReactNode } from "react";

import styles from "./index.module.css";

function HeroSection() {
    const { siteConfig } = useDocusaurusContext();
    const logoUrl = useBaseUrl("/logo.svg");
    return (
        <header className={styles.hero}>
            <div className={styles.heroInner}>
                <div className={styles.heroHeader}>
                    <h1 className={styles.heroTitle}>GTK</h1>
                    <img src={logoUrl} alt="GTKX Logo" className={styles.heroLogo} />
                </div>
                <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
                <div className={styles.heroButtons}>
                    <Link className={styles.heroButtonPrimary} to="/docs/getting-started">
                        Get Started
                    </Link>
                </div>
            </div>
        </header>
    );
}

function DemoSection() {
    const demoUrl = useBaseUrl("/demo.mp4");
    return (
        <section className={styles.demo}>
            <div className={styles.demoInner}>
                <h2 className={styles.sectionTitle}>See it in Action</h2>
                <p className={styles.sectionSubtitle}>Build native GTK4 applications with familiar React patterns</p>
                <div className={styles.demoVideo}>
                    <video autoPlay loop muted playsInline className={styles.video}>
                        <source src={demoUrl} type="video/mp4" />
                    </video>
                </div>
            </div>
        </section>
    );
}

function CodeExample() {
    const code = `import { GtkApplicationWindow, GtkBox, GtkButton, GtkLabel, quit } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const App = () => {
 const [count, setCount] = useState(0);

 return (
 <GtkApplicationWindow title="Counter" defaultWidth={400} defaultHeight={300} onClose={quit}>
 <GtkBox orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} spacing={20}>
 <GtkLabel label={\`Count: \${count}\`} cssClasses={["title-1"]} />
 <GtkButton label="Increment" onClicked={() => setCount(c => c + 1)} cssClasses={["pill", "suggested-action"]} />
 </GtkBox>
 </GtkApplicationWindow>
 );
};`;

    return (
        <section className={styles.codeExample}>
            <div className={styles.codeExampleInner}>
                <h2 className={styles.sectionTitle}>Write React, Ship Native</h2>
                <p className={styles.sectionSubtitle}>
                    Use the React you know — components, hooks, state management — to build real GTK4 desktop apps
                </p>
                <div className={styles.codeBlock}>
                    <CodeBlock language="tsx">{code}</CodeBlock>
                </div>
            </div>
        </section>
    );
}

interface FeatureProps {
    title: string;
    description: string;
    icon: string;
}

function Feature({ title, description, icon }: FeatureProps) {
    return (
        <div className={styles.feature}>
            <div className={styles.featureIcon}>{icon}</div>
            <h3 className={styles.featureTitle}>{title}</h3>
            <p className={styles.featureDescription}>{description}</p>
        </div>
    );
}

function FeaturesSection() {
    const features: FeatureProps[] = [
        {
            title: "React Components",
            description: "Full React 19 support with hooks, state, effects, and the component model you already know.",
            icon: "⚛️",
        },
        {
            title: "Native Performance",
            description: "No Electron. No WebView. Direct GTK4 bindings via Rust/Neon for true native speed.",
            icon: "🚀",
        },
        {
            title: "Complete GTK4 API",
            description: "Access every GTK4, Libadwaita, and GLib widget and function through typed bindings.",
            icon: "🧩",
        },
        {
            title: "Hot Module Replacement",
            description: "Instant feedback during development with Vite-powered HMR for rapid iteration.",
            icon: "⚡",
        },
        {
            title: "CSS-in-JS",
            description: "Style your apps with familiar CSS-in-JS patterns that compile to GTK CSS.",
            icon: "🎨",
        },
        {
            title: "Testing & MCP",
            description:
                "Test components with a Testing Library-like API and integrate AI agents via the built-in MCP server.",
            icon: "🧪",
        },
    ];

    return (
        <section className={styles.features}>
            <div className={styles.featuresInner}>
                <h2 className={styles.sectionTitle}>Why GTKX?</h2>
                <div className={styles.featuresGrid}>
                    {features.map((feature) => (
                        <Feature key={feature.title} {...feature} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function CTASection() {
    return (
        <section className={styles.cta}>
            <div className={styles.ctaInner}>
                <h2 className={styles.ctaTitle}>Ready to build?</h2>
                <p className={styles.ctaSubtitle}>Get started with GTKX in under a minute</p>
                <pre className={styles.ctaCode}>
                    <code>npx @gtkx/cli create my-app</code>
                </pre>
                <div>
                    <Link className={styles.heroButtonPrimary} to="/docs/getting-started">
                        Read the Docs
                    </Link>
                </div>
            </div>
        </section>
    );
}

export default function Home(): ReactNode {
    const { siteConfig } = useDocusaurusContext();
    return (
        <Layout title={siteConfig.title} description={siteConfig.tagline}>
            <HeroSection />
            <main>
                <FeaturesSection />
                <DemoSection />
                <CodeExample />
                <CTASection />
            </main>
        </Layout>
    );
}
