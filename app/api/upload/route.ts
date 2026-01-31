import { NextRequest, NextResponse } from 'next/server';
import { parsePDF } from '@/lib/pdfParser';
import { parseImage } from '@/lib/imageParser';
import { appendToSheet } from '@/lib/googleSheets';
import { UploadResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            const response: UploadResponse = {
                success: false,
                message: 'No file uploaded',
                error: 'Please select a file to upload',
            };
            return NextResponse.json(response, { status: 400 });
        }

        // Validate file type - accept PDF and images
        const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            const response: UploadResponse = {
                success: false,
                message: 'Invalid file type',
                error: 'Please upload a PDF or image file (PNG, JPG, JPEG)',
            };
            return NextResponse.json(response, { status: 400 });
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Parse based on file type
        let parseResult;
        if (file.type === 'application/pdf') {
            parseResult = await parsePDF(buffer);
        } else {
            // Use OCR for images
            parseResult = await parseImage(buffer);
        }

        if (!parseResult.success || !parseResult.data) {
            const response: UploadResponse = {
                success: false,
                message: 'Failed to parse invoice',
                error: parseResult.error || 'Could not extract invoice data',
            };
            return NextResponse.json(response, { status: 400 });
        }

        // Append to Google Sheet
        try {
            await appendToSheet(parseResult.data);
        } catch (error) {
            console.error('Google Sheets error:', error);
            const response: UploadResponse = {
                success: false,
                message: 'Failed to log to Google Sheets',
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
            return NextResponse.json(response, { status: 500 });
        }

        // Success response
        const response: UploadResponse = {
            success: true,
            message: 'Invoice processed successfully',
            data: parseResult.data,
        };

        return NextResponse.json(response, { status: 200 });
    } catch (error) {
        console.error('Upload error:', error);
        const response: UploadResponse = {
            success: false,
            message: 'Server error',
            error: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
        return NextResponse.json(response, { status: 500 });
    }
}
