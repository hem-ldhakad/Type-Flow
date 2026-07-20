// src/pages/HomePage.jsx
import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';

const features = [
    { icon: '⚡', title: 'Real-time Races', desc: 'Compete live against other typists in multiplayer rooms with instant progress tracking.' },
    { icon: '🎋', title: 'XP & Leveling', desc: 'Earn bamboo-powered XP, level up, and climb the global leaderboard.' },
    { icon: '📊', title: 'Deep Analytics', desc: 'Track WPM trends, accuracy heatmaps, and personal records over time.' },
    { icon: '🐼', title: 'Panda Flair', desc: 'A cozy, panda-themed experience that makes even losing feel adorable.' },
];

export default function HomePage() {
    return (
        <div className={styles.page}>
            {/* Hero */}
            <section className={styles.hero}>
                <div className="container">
                    <div className={styles.heroBadge}>
                        <span className="badge badge-green">🎋 Season 1 Live</span>
                    </div>
                    <h1 className={styles.heroTitle}>
                        Type Fast.<br />
                        <span className={styles.heroAccent}>Race Together.</span>
                    </h1>
                    <p className={styles.heroSub}>
                        Multiplayer typing races with real-time competition, stats tracking, and a cute panda cheering you on.
                    </p>
                    <div className={styles.heroCta}>
                        <Link to="/register" className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.8rem 2rem' }}>
                            🐼 Start Typing Free
                        </Link>
                        <Link to="/login" className="btn btn-ghost" style={{ fontSize: '1rem', padding: '0.8rem 1.5rem' }}>
                            Sign in
                        </Link>
                    </div>
                    {/* Decorative panda */}
                    <div className={styles.pandaDecor} aria-hidden>🐼</div>
                </div>
            </section>

            {/* Features */}
            <section className={styles.features}>
                <div className="container">
                    <h2 className={styles.sectionTitle}>Why TypeFLOW?</h2>
                    <div className={styles.featureGrid}>
                        {features.map((f) => (
                            <div key={f.title} className={`card ${styles.featureCard}`}>
                                <span className={styles.featureIcon}>{f.icon}</span>
                                <h3 className={styles.featureTitle}>{f.title}</h3>
                                <p className={styles.featureDesc}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats banner */}
            <section className={styles.statsBanner}>
                <div className="container">
                    <div className={styles.statsRow}>
                        {[
                            { value: '12,400+', label: 'Racers joined' },
                            { value: '240K+', label: 'Races completed' },
                            { value: '148 WPM', label: 'Top recorded speed' },
                            { value: '99.8%', label: 'Uptime' },
                        ].map((s) => (
                            <div key={s.label} className={styles.statItem}>
                                <span className={styles.statValue}>{s.value}</span>
                                <span className={styles.statLabel}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
