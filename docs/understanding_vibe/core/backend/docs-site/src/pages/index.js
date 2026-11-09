import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={clsx('hero', styles.heroBanner)}>
      {/* Fond animé avec particules */}
      <div className={styles.particles}>
        {[...Array(20)].map((_, i) => (
          <span
            key={i}
            className={styles.particle}
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Gradient animé en arrière-plan */}
      <div className={styles.gradientBg} />

      <div className={clsx('container', styles.heroContent)}>
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          Documentation technique
        </div>

        <h1 className={clsx('hero__title', styles.title)}>
          <span className={styles.titleGradient}>{siteConfig.title}</span>
        </h1>

        <p className={clsx('hero__subtitle', styles.subtitle)}>
          {siteConfig.tagline}
        </p>

        <div className={styles.buttons}>
          <Link
            className={clsx('button', styles.ctaButton)}
            to="/docs/intro">
            <span>Commencer la lecture</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Link
            className={clsx('button', styles.secondaryButton)}
            to="/docs/diagrams">
            Voir les diagrammes
          </Link>
        </div>

        {/* Stats animées */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNumber}>9</span>
            <span className={styles.statLabel}>fichiers Python</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNumber}>3203</span>
            <span className={styles.statLabel}>lignes de code</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNumber}>5</span>
            <span className={styles.statLabel}>adapters</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNumber}>2</span>
            <span className={styles.statLabel}>backends</span>
          </div>
        </div>
      </div>

      {/* Vague décorative en bas */}
      <svg className={styles.wave} viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path
          d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,69.3C960,85,1056,107,1152,101.3C1248,96,1344,64,1392,48L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
          fill="var(--ifm-background-color)"
        />
      </svg>
    </header>
  );
}

const features = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" strokeLinecap="round"/>
        <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round"/>
        <path d="M8 12h8M8 16h5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Abstraction unifiée',
    description: 'Une interface unique pour communiquer avec Mistral, OpenAI, Anthropic, Vertex AI et autres fournisseurs LLM.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Streaming SSE',
    description: 'Reception des tokens en temps réel via Server-Sent Events pour une expérience interactive.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Resilience',
    description: 'Retry avec backoff exponentiel, budget temporel et pacing adaptatif pour gerer les rate limits.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round"/>
        <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round"/>
        <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round"/>
        <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Modulaire',
    description: 'Separation claire : Backends pour le transport, Adapters pour la traduction, Factory pour la creation.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" strokeLinecap="round"/>
        <path d="M7 14l4-4 4 3 5-6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Observabilité',
    description: 'Tracing OpenTelemetry integre, logging detaille et observateurs de retry personnalisables.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" strokeLinecap="round"/>
        <rect x="8" y="2" width="8" height="4" rx="1" strokeLinecap="round"/>
        <path d="M9 12h6M9 16h4" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Extensible',
    description: 'Ajout de nouveaux providers via un simple adapter ou un nouveau backend personnalise.',
  },
];

function FeatureCard({ icon, title, description, index }) {
  return (
    <div
      className={styles.featureCard}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className={styles.featureIcon}>{icon}</div>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDescription}>{description}</p>
    </div>
  );
}

function HomepageFeatures() {
  return (
    <section className={styles.featuresSection}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Fonctionnalités</span>
          <h2 className={styles.sectionTitle}>Ce que fait le module backend</h2>
          <p className={styles.sectionDescription}>
            Un aperçu des capacités principales du module de communication LLM.
          </p>
        </div>
        <div className={styles.featuresGrid}>
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function QuickLinks() {
  const links = [
    { to: '/docs/overview', title: "Vue d'ensemble", desc: 'Comprendre le rôle du module' },
    { to: '/docs/architecture', title: 'Architecture', desc: 'Principes de conception' },
    { to: '/docs/diagrams', title: 'Diagrammes', desc: 'Visualiser les flux' },
    { to: '/docs/usage', title: 'Utilisation', desc: 'Guide pratique et exemples' },
  ];

  return (
    <section className={styles.quickLinksSection}>
      <div className="container">
        <div className={styles.quickLinksGrid}>
          {links.map((l, i) => (
            <Link key={i} to={l.to} className={styles.quickLink}>
              <span className={styles.quickLinkArrow}>→</span>
              <div>
                <span className={styles.quickLinkTitle}>{l.title}</span>
                <span className={styles.quickLinkDesc}>{l.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Accueil | ${siteConfig.title}`}
      description="Documentation du module backend LLM de Mistral Vibe - vibe/core/llm/backend/">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <QuickLinks />
      </main>
    </Layout>
  );
}
