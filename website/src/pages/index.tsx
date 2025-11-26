/** biome-ignore-all lint/suspicious/noArrayIndexKey: allow */
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Heading from "@theme/Heading";
import Layout from "@theme/Layout";
import clsx from "clsx";
import type { ReactNode } from "react";

import styles from "./index.module.css";

function HomepageHeader() {
    const { siteConfig } = useDocusaurusContext();
    const logoUrl = useBaseUrl("/img/logo.svg");
    return (
        <header className={clsx("hero hero--primary", styles.heroBanner)}>
            <div className="container">
                <img src={logoUrl} alt="GTKX Logo" className={styles.heroLogo} />
                <Heading as="h1" className="hero__title">
                    {siteConfig.title}
                </Heading>
                <p className="hero__subtitle">{siteConfig.tagline}</p>
                <div className={styles.buttons}>
                    <Link className="button button--secondary button--lg" to="/docs">
                        Get Started
                    </Link>
                    <Link
                        className="button button--secondary button--lg"
                        to="https://github.com/eugeniodepalo/gtkx"
                        style={{ marginLeft: "1rem" }}
                    >
                        GitHub
                    </Link>
                </div>
            </div>
        </header>
    );
}

type FeatureItem = {
    title: string;
    description: ReactNode;
};

const FeatureList: FeatureItem[] = [
    {
        title: "React Patterns",
        description: (
            <>
                Use familiar React patterns like hooks, state management, and component composition to build native GTK4
                applications.
            </>
        ),
    },
    {
        title: "Type Safe",
        description: <>Full TypeScript support with auto-generated types from GTK's GObject Introspection files.</>,
    },
    {
        title: "Native Performance",
        description: (
            <>Direct FFI calls to GTK4 through a Rust native module. No Electron, no WebView - just native widgets.</>
        ),
    },
];

function Feature({ title, description }: FeatureItem) {
    return (
        <div className={clsx("col col--4")}>
            <div className="text--center padding-horiz--md">
                <Heading as="h3">{title}</Heading>
                <p>{description}</p>
            </div>
        </div>
    );
}

function HomepageFeatures(): ReactNode {
    return (
        <section className={styles.features}>
            <div className="container">
                <div className="row">
                    {FeatureList.map((props, idx) => (
                        <Feature key={idx} {...props} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function Showcase(): ReactNode {
    const screenshotUrl = useBaseUrl("/img/screenshot.png");
    return (
        <section className={styles.showcase}>
            <div className="container">
                <Heading as="h2" className="text--center margin-bottom--lg">
                    Native GTK4 Widgets
                </Heading>
                <div className="row">
                    <div className="col col--10 col--offset-1">
                        <img
                            src={screenshotUrl}
                            alt="GTKX Kitchen Sink Demo"
                            className={styles.screenshot}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

function CodeExample(): ReactNode {
    return (
        <section className={styles.codeExample}>
            <div className="container">
                <Heading as="h2" className="text--center margin-bottom--lg">
                    Simple and Familiar
                </Heading>
                <div className="row">
                    <div className="col col--8 col--offset-2">
                        <pre className={styles.codeBlock}>
                            <code>
                                {`import { ApplicationWindow, Button, quit, render } from "@gtkx/gtkx";

render(
  <ApplicationWindow
    title="Hello, GTKX!"
    defaultWidth={400}
    defaultHeight={300}
    onCloseRequest={quit}
  >
    <Button
      label="Click me!"
      onClicked={() => console.log("Clicked!")}
    />
  </ApplicationWindow>,
  "com.example.app"
);`}
                            </code>
                        </pre>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function Home(): ReactNode {
    return (
        <Layout title="Home" description="Build GTK4 desktop applications with React and TypeScript">
            <HomepageHeader />
            <main>
                <HomepageFeatures />
                <CodeExample />
                <Showcase />
            </main>
        </Layout>
    );
}
