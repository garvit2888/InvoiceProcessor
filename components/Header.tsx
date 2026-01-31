import Link from 'next/link';
import styles from './Header.module.css';

export default function Header() {
    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <Link href="/" className={styles.logo}>
                    <svg
                        className={styles.logoIcon}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                    <span>InvoiceFlow</span>
                </Link>

                <nav className={styles.nav}>
                    <Link href="/" className={styles.navLink}>
                        Home
                    </Link>
                    <Link href="/upload" className={`${styles.navLink} ${styles.navLinkPrimary}`}>
                        Upload Invoice
                    </Link>
                </nav>
            </div>
        </header>
    );
}
