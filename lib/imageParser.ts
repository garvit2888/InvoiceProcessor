import { createWorker } from 'tesseract.js';
import { InvoiceData, ParseResult } from './types';

/**
 * Extract invoice data from image buffer using OCR
 */
export async function parseImage(buffer: Buffer): Promise<ParseResult> {
    try {
        console.log('Starting OCR processing...');
        console.log('Image buffer size:', buffer.length, 'bytes');

        // Create Tesseract worker with progress logging
        const worker = await createWorker('eng', 1, {
            logger: (m: any) => console.log('OCR Progress:', m),
        });

        console.log('Worker created, starting recognition...');

        // Perform OCR on the image with timeout
        const recognitionPromise = worker.recognize(buffer);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('OCR timeout after 60 seconds')), 60000)
        );

        const result: any = await Promise.race([recognitionPromise, timeoutPromise]);
        const text = result.data.text;

        console.log('OCR completed, terminating worker...');

        // Terminate worker
        await worker.terminate();

        console.log('=== OCR TEXT EXTRACTION ===');
        console.log('Total text length:', text.length);
        console.log('Extracted text:');
        console.log(text);
        console.log('=========================');

        if (!text || text.length < 10) {
            return {
                success: false,
                error: 'No text could be extracted from the image. Please ensure the image is clear and readable.',
            };
        }

        // Extract invoice data using regex patterns
        const invoiceData = extractInvoiceData(text);

        console.log('=== EXTRACTED DATA ===');
        console.log(JSON.stringify(invoiceData, null, 2));
        console.log('=====================');

        // For Flipkart, accept if we have at least order ID or invoice number
        if (!invoiceData.orderId || invoiceData.orderId === 'N/A') {
            return {
                success: false,
                error: 'Could not extract order ID from the invoice. Please ensure the image contains a valid Flipkart invoice.',
            };
        }

        return {
            success: true,
            data: invoiceData,
        };
    } catch (error) {
        console.error('OCR processing error:', error);
        return {
            success: false,
            error: `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Extract invoice data from text using regex patterns
 * Optimized for Flipkart invoices based on the sample format
 */
function extractInvoiceData(text: string): InvoiceData {
    // Clean up text - remove extra spaces and normalize
    const cleanText = text.replace(/\s+/g, ' ').trim();

    // Order ID patterns - Flipkart specific (OD followed by digits)
    const orderIdPatterns = [
        /OD\d{18,}/gi,  // Flipkart order format: OD + 18 digits
        /Order\s*(?:ID|Id|id|No|Number)[:\s]*([A-Z]{2}\d{18,})/i,
        /Invoice.*?Order\s*Id[:\s]*([A-Z0-9]{15,})/i,
    ];

    // Invoice Number patterns
    const invoiceNoPatterns = [
        /Invoice\s*(?:No|Number|#)[:\s]*([A-Z0-9]{10,})/i,
        /FAXCR\d+/i,  // Flipkart invoice format
    ];

    // Date patterns - Flipkart uses DD-MM-YYYY HH:MM format
    const datePatterns = [
        /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/,
        /Invoice\s*Date[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
        /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    ];

    // Price patterns - look for total price
    const pricePatterns = [
        /TOTAL\s*PRICE[:\s]*₹?\s*([\d,]+\.?\d*)/i,
        /Total[:\s]*₹\s*([\d,]+\.?\d*)/i,
        /₹\s*([\d,]+\.00)/,
        /Gross\s*Value[:\s]*₹?\s*([\d,]+\.?\d*)/i,
    ];

    // Item name patterns - product description
    const itemPatterns = [
        /Description[:\s]*([^\n]{10,150})/i,
        /Product[:\s]*([^\n]{10,150})/i,
        /Vonue[^\n]{5,150}/i,  // Specific to the sample
    ];

    // Address patterns - Flipkart shipping address format
    const addressPatterns = [
        /Shipping\s*(?:\/|\\)?Customer\s*address[:\s]*Name[:\s]*([^,]+,[^,]+,[^,]+,[^,]+)/i,
        /Shipping\s*ADDRESS[:\s]*([^\n]+(?:\n[^\n]+){0,3})/i,
        /Name[:\s]*([A-Za-z\s]+)[,\s]+([^,]+)[,\s]+([^,]+)[,\s]+([^,]+)/i,
    ];

    // State patterns - extract from address
    const statePatterns = [
        /\(([A-Za-z\s]+)\)/,  // State in parentheses like (West Bengal)
        /,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[-,]?\s*\d{6}/,
        /West\s+Bengal|Maharashtra|Karnataka|Tamil\s+Nadu|Gujarat|Rajasthan|Uttar\s+Pradesh|Madhya\s+Pradesh|Bihar|Andhra\s+Pradesh|Telangana|Kerala|Odisha|Punjab|Haryana|Assam|Jharkhand|Chhattisgarh|Uttarakhand|Himachal\s+Pradesh|Goa|Jammu\s+and\s+Kashmir|Delhi/i,
    ];

    // Extract data
    let orderId = '';
    let date = '';
    let price = '';
    let itemName = '';
    let deliveryAddress = '';
    let deliveryState = '';

    // Extract Order ID
    for (const pattern of orderIdPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            orderId = (match[1] || match[0]).trim();
            if (orderId.length >= 15) {
                break;
            }
        }
    }

    // If no order ID, try invoice number
    if (!orderId) {
        for (const pattern of invoiceNoPatterns) {
            const match = cleanText.match(pattern);
            if (match) {
                orderId = (match[1] || match[0]).trim();
                break;
            }
        }
    }

    // Extract date
    for (const pattern of datePatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            date = (match[1] || match[0]).trim();
            break;
        }
    }

    // Extract price
    for (const pattern of pricePatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            price = match[1].replace(/,/g, '').trim();
            if (!price.startsWith('₹')) {
                price = '₹' + price;
            }
            const numPrice = parseFloat(price.replace('₹', ''));
            if (numPrice > 0) {
                break;
            }
        }
    }

    // Extract item name
    for (const pattern of itemPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            itemName = (match[1] || match[0]).trim();
            itemName = itemName.replace(/\s+/g, ' ').substring(0, 200);
            if (itemName.length > 10) {
                break;
            }
        }
    }

    // Extract delivery address
    for (const pattern of addressPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            if (match[1] && match[2] && match[3]) {
                // Multi-group match
                deliveryAddress = `${match[1]}, ${match[2]}, ${match[3]}`;
                if (match[4]) deliveryAddress += `, ${match[4]}`;
            } else {
                deliveryAddress = match[1].trim();
            }
            deliveryAddress = deliveryAddress.replace(/\s+/g, ' ').substring(0, 300);
            break;
        }
    }

    // Extract state
    for (const pattern of statePatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            deliveryState = match[1] ? match[1].trim() : match[0].trim();
            if (deliveryState.length >= 3 && !deliveryState.match(/\d/)) {
                break;
            }
        }
    }

    return {
        orderId: orderId || 'N/A',
        date: date || 'N/A',
        price: price || 'N/A',
        itemName: itemName || 'N/A',
        deliveryAddress: deliveryAddress || 'N/A',
        deliveryState: deliveryState || 'N/A',
    };
}
