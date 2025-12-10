import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import CodeBlock from "@theme/CodeBlock";
import Layout from "@theme/Layout";
import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./index.module.css";

const HomepageHeader = () => {
    const { siteConfig } = useDocusaurusContext();
    return (
        <header className={clsx("hero hero--primary", styles.heroBanner)}>
            <div className="container">
                <img src="/gtkx/img/logo.svg" alt="GTKX Logo" className={styles.heroLogo} />
                <h1 className="hero__title">{siteConfig.title}</h1>
                <p className="hero__subtitle">{siteConfig.tagline}</p>
                <div className={styles.buttons}>
                    <Link className="button button--secondary button--lg" to="/docs/introduction">
                        Get Started
                    </Link>
                </div>
            </div>
        </header>
    );
};

type FeatureItem = {
    title: string;
    icon: string;
    description: ReactNode;
};

const features: FeatureItem[] = [
    {
        title: "React",
        icon: "⚛️",
        description:
            "Hooks, state, props, and components you already know. Write JSX that renders as native GTK4 widgets.",
    },
    {
        title: "Hot Reload",
        icon: "🔥",
        description: "Edit code and see changes instantly. Vite-powered HMR with no app restart needed.",
    },
    {
        title: "Native",
        icon: "🚀",
        description: "Direct FFI bindings to GTK4 via Rust and libffi. No Electron, no web views.",
    },
    {
        title: "CLI",
        icon: "⚡",
        description: "npx @gtkx/cli@latest create scaffolds a project with TypeScript, testing, and HMR ready to go.",
    },
    {
        title: "CSS-in-JS",
        icon: "🎨",
        description: "Emotion-style css template literals for GTK widgets. Compose and reuse styles easily.",
    },
    {
        title: "Testing",
        icon: "🧪",
        description: "Testing Library-style API with screen, userEvent, and queries for GTK widgets.",
    },
];

const Feature = ({ title, icon, description }: FeatureItem) => {
    return (
        <div className={clsx("col col--4")}>
            <div className={styles.featureCard}>
                <div className={styles.featureIcon}>{icon}</div>
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
        </div>
    );
};

const HomepageFeatures = () => {
    return (
        <section className={styles.features}>
            <div className="container">
                <div className="row">
                    {features.map((props) => (
                        <Feature key={props.title} {...props} />
                    ))}
                </div>
            </div>
        </section>
    );
};

const codeExample = `import { render, ApplicationWindow, Box, Button, Label, quit } from "@gtkx/react";
import { Orientation } from "@gtkx/ffi/gtk";
import { css } from "@gtkx/css";
import { useState } from "react";

const primary = css\`
  padding: 12px 24px;
  border-radius: 8px;
  background: linear-gradient(135deg, #3584e4, #1a5fb4);
  color: white;
\`;

const App = () => {
  const [count, setCount] = useState(0);

  return (
    <ApplicationWindow title="Counter" onCloseRequest={quit}>
      <Box orientation={Orientation.VERTICAL} spacing={12} margin={20}>
        <Label.Root label={\`Count: \${count}\`} cssClasses={["title-1"]} />
        <Button
          label="Increment"
          cssClasses={[primary]}
          onClicked={() => setCount(c => c + 1)}
        />
      </Box>
    </ApplicationWindow>
  );
};

render(<App />, "org.example.Counter");`;

const CodeExample = () => {
    return (
        <section className={styles.codeExample}>
            <div className="container">
                <h2>Simple and Familiar</h2>
                <p>Write React components that render as native GTK4 widgets</p>
                <div className={styles.codeBlockWrapper}>
                    <CodeBlock language="tsx">{codeExample}</CodeBlock>
                </div>
            </div>
        </section>
    );
};

const Screenshot = () => {
    return (
        <section className={styles.screenshot}>
            <div className="container">
                <h2>Native Desktop Apps</h2>
                <p>Build beautiful, native GTK4 applications that feel right at home on Linux</p>
                <div className={styles.screenshotWrapper}>
                    <img
                        src="/gtkx/img/screenshot.png"
                        alt="GTKX Demo Application"
                        className={styles.screenshotImage}
                    />
                </div>
            </div>
        </section>
    );
};

const Home = () => {
    const { siteConfig } = useDocusaurusContext();
    return (
        <Layout title={siteConfig.title} description={siteConfig.tagline}>
            <HomepageHeader />
            <main>
                <HomepageFeatures />
                <CodeExample />
                <Screenshot />
            </main>
        </Layout>
    );
};

export default Home;
