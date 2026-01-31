'use client';

import { useState } from 'react';
import UploadZone from '@/components/UploadZone';
import InvoicePreview from '@/components/InvoicePreview';
import { InvoiceData, UploadResponse } from '@/lib/types';
import styles from './page.module.css';

export default function UploadPage() {
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<InvoiceData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = async (file: File) => {
        setIsUploading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data: UploadResponse = await response.json();

            if (data.success && data.data) {
                setResult(data.data);
            } else {
                setError(data.error || 'Failed to process invoice');
            }
        } catch (err) {
            console.error('Upload error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleReset = () => {
        setResult(null);
        setError(null);
    };

    return (
        <main className={styles.main}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1>Upload Invoice</h1>
                    <p>Upload your invoice PDF to automatically extract and log data to Google Sheets</p>
                </div>

                <div className={styles.content}>
                    {!result && !error && (
                        <UploadZone onFileSelect={handleFileSelect} isUploading={isUploading} />
                    )}

                    {error && (
                        <div className={styles.error}>
                            <svg
                                className={styles.errorIcon}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <h3>Error Processing Invoice</h3>
                            <p>{error}</p>
                            <button onClick={handleReset} className="btn btn-primary">
                                Try Again
                            </button>
                        </div>
                    )}

                    {result && (
                        <div className={styles.success}>
                            <InvoicePreview data={result} />
                            <div className={styles.actions}>
                                <button onClick={handleReset} className="btn btn-primary">
                                    Upload Another Invoice
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {!result && !error && (
                    <div className={styles.info}>
                        <h3>What data will be extracted?</h3>
                        <ul>
                            <li>Order ID</li>
                            <li>Invoice Date</li>
                            <li>Total Price/Amount</li>
                            <li>Item Name/Description</li>
                            <li>Delivery Address</li>
                            <li>Delivery State</li>
                        </ul>
                    </div>
                )}
            </div>
        </main>
    );
}
