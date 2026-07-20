// src/pages/NotFoundPage.jsx
import { Link } from 'react-router-dom';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
    return (
        <div className={styles.page}>
            <div className={styles.content}>
                <span className={styles.panda}>🐼</span>
                <h1 className={styles.code}>404</h1>
                <p className={styles.message}>Oops! This bamboo trail doesn&apos;t exist.</p>
                <Link to="/" className="btn btn-primary">Back to home 🎋</Link>
            </div>
        </div>
    );
}
