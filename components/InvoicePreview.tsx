import { InvoiceData } from '@/lib/types';
import styles from './InvoicePreview.module.css';

interface InvoicePreviewProps {
    data: InvoiceData;
}

export default function InvoicePreview({ data }: InvoicePreviewProps) {
    return (
        <div className={styles.preview}>
            <div className={styles.header}>
                <svg
                    className={styles.successIcon}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <h3>Invoice Processed Successfully!</h3>
                <p>The following data has been logged to your Google Sheet</p>
            </div>

            <div className={styles.dataGrid}>
                <div className={styles.dataItem}>
                    <span className={styles.label}>Order ID</span>
                    <span className={styles.value}>{data.orderId || 'Not found'}</span>
                </div>

                <div className={styles.dataItem}>
                    <span className={styles.label}>Date</span>
                    <span className={styles.value}>{data.date || 'Not found'}</span>
                </div>

                <div className={styles.dataItem}>
                    <span className={styles.label}>Price</span>
                    <span className={styles.value}>{data.price || 'Not found'}</span>
                </div>

                <div className={styles.dataItem}>
                    <span className={styles.label}>Item Name</span>
                    <span className={styles.value}>{data.itemName || 'Not found'}</span>
                </div>

                <div className={styles.dataItem}>
                    <span className={styles.label}>Delivery Address</span>
                    <span className={styles.value}>{data.deliveryAddress || 'Not found'}</span>
                </div>

                <div className={styles.dataItem}>
                    <span className={styles.label}>State</span>
                    <span className={styles.value}>{data.deliveryState || 'Not found'}</span>
                </div>
            </div>
        </div>
    );
}
