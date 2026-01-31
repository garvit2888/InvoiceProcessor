'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import styles from './UploadZone.module.css';

interface UploadZoneProps {
    onFileSelect: (file: File) => void;
    isUploading?: boolean;
}

export default function UploadZone({ onFileSelect, isUploading = false }: UploadZoneProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setSelectedFile(file);
            onFileSelect(file);
        }
    }, [onFileSelect]);

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg'],
        },
        maxFiles: 1,
        disabled: isUploading,
    });

    return (
        <div
            {...getRootProps()}
            className={`${styles.uploadZone} ${isDragActive ? styles.dragActive : ''} ${isDragReject ? styles.dragReject : ''
                } ${isUploading ? styles.uploading : ''}`}
        >
            <input {...getInputProps()} />

            <div className={styles.iconContainer}>
                {isUploading ? (
                    <div className={styles.spinner} />
                ) : (
                    <svg
                        className={styles.uploadIcon}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                    </svg>
                )}
            </div>

            <div className={styles.content}>
                {isUploading ? (
                    <>
                        <h3>Processing Invoice...</h3>
                        <p>Please wait while we extract the data</p>
                    </>
                ) : selectedFile ? (
                    <>
                        <h3>File Selected</h3>
                        <p className={styles.fileName}>{selectedFile.name}</p>
                        <p className={styles.fileSize}>
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </>
                ) : isDragActive ? (
                    <>
                        <h3>Drop your invoice here</h3>
                        <p>Release to upload</p>
                    </>
                ) : (
                    <>
                        <h3>Upload Invoice PDF</h3>
                        <p>Drag and drop your invoice PDF or image here, or click to browse</p>
                        <span className={styles.hint}>Supports PDF files up to 10MB or images (PNG, JPG)</span>
                    </>
                )}
            </div>
        </div>
    );
}
