import { InvoiceData, ParseResult } from './types';
import PDFParser from 'pdf2json';

/**
 * Extract invoice data from PDF buffer
 */
export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
    try {
        // Use pdf2json to parse the PDF
        const pdfParser = new PDFParser();

        // Create a promise to handle the async parsing
        const pdfData = await new Promise<any>((resolve, reject) => {
            pdfParser.on('pdfParser_dataError', (errData: any) => {
                console.error('PDF Parser Error:', errData.parserError);
                reject(new Error(errData.parserError));
            });

            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                resolve(pdfData);
            });

            // Parse the buffer
            pdfParser.parseBuffer(buffer);
        });

        // Extract text from parsed PDF
        let fullText = '';

        if (pdfData && pdfData.Pages) {
            for (const page of pdfData.Pages) {
                if (page.Texts) {
                    for (const text of page.Texts) {
                        if (text.R) {
                            for (const run of text.R) {
                                if (run.T) {
                                    try {
                                        // Decode URI component (pdf2json encodes text)
                                        const decodedText = decodeURIComponent(run.T);
                                        fullText += decodedText + ' ';
                                    } catch (e) {
                                        // If decoding fails, use the raw text
                                        fullText += run.T + ' ';
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        console.log('=== PDF TEXT EXTRACTION ===');
        console.log('Total text length:', fullText.length);
        console.log('Extracted text:');
        console.log(fullText);
        console.log('=========================');

        if (!fullText || fullText.length < 10) {
            return {
                success: false,
                error: 'No text could be extracted from the PDF. The PDF might be image-based or corrupted.',
            };
        }

        // Extract invoice data using regex patterns
        const invoiceData = extractInvoiceData(fullText);

        console.log('=== EXTRACTED DATA ===');
        console.log(JSON.stringify(invoiceData, null, 2));
        console.log('=====================');

        // For Flipkart, accept if we have at least order ID
        if (!invoiceData.orderId || invoiceData.orderId === 'N/A') {
            return {
                success: false,
                error: 'Could not extract order ID from the invoice. Please ensure the PDF is a valid Flipkart invoice.',
            };
        }

        return {
            success: true,
            data: invoiceData,
        };
    } catch (error) {
        console.error('PDF parsing error:', error);
        return {
            success: false,
            error: `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Extract invoice data from text using regex patterns
 * Handles spaced text format from pdf2json (e.g., "O D 4 3 6...")
 */
function extractInvoiceData(text: string): InvoiceData {
    // The text has spaces between characters, so we need to handle that
    // Example: "O D 4 3 6 5 0 6 3 1 2 3 2 9 4 8 6 1 0 0"

    console.log('Extracting data from text...');

    // Order ID patterns - match spaced format
    const orderIdMatch = text.match(/O\s*D\s*(\d[\d\s]{17,})/i);
    let orderId = '';
    if (orderIdMatch) {
        orderId = 'OD' + orderIdMatch[1].replace(/\s+/g, '');
        console.log('Found Order ID:', orderId);
    }

    // Date patterns - match format like "1 2 - 0 1 - 2 0 2 6" or "12-01-2026"
    let date = '';
    const dateMatch = text.match(/(\d\s*\d?)\s*-\s*(\d\s*\d?)\s*-\s*(\d\s*\d\s*\d\s*\d)/);
    if (dateMatch) {
        const day = dateMatch[1].replace(/\s+/g, '');
        const month = dateMatch[2].replace(/\s+/g, '');
        const year = dateMatch[3].replace(/\s+/g, '');
        date = `${day}-${month}-${year}`;
        console.log('Found Date:', date);
    }

    // Price patterns - look for total/gross amount with extended keywords
    let price = '';

    // Expanded keywords for total amount (handle spaced text)
    const totalKeywords = [
        'T\\s*o\\s*t\\s*a\\s*l',
        'G\\s*r\\s*o\\s*s\\s*s',
        'G\\s*r\\s*a\\s*n\\s*d\\s*T\\s*o\\s*t\\s*a\\s*l',
        'P\\s*a\\s*y\\s*a\\s*b\\s*l\\s*e',
        'A\\s*m\\s*o\\s*u\\s*n\\s*t',
        'N\\s*e\\s*t'
    ].join('|');

    // Regex to find price after a keyword
    // Matches keyword, optional text (non-greedy), then a number with decimals
    const priceRegex = new RegExp(`(?:${totalKeywords}).{0,100}?(\\d[\\d\\s,]*\\.\\s*\\d\\s*\\d)`, 'i');

    const totalPriceMatch = text.match(priceRegex);

    if (totalPriceMatch) {
        // Clean up the price - remove spaces and commas
        const cleanPrice = totalPriceMatch[1].replace(/[\s,]+/g, '');
        const numPrice = parseFloat(cleanPrice);

        // Basic validation - price should be reasonable
        // Lower bound 10 to catch small orders, upper bound 500k
        if (numPrice > 10 && numPrice < 500000) {
            price = '₹' + cleanPrice;
            console.log('Found Total Price via Keyword:', price);
        }
    }

    // Fallback: If no keyword match, look for any price-like number
    // But be smarter: avoid phone numbers (usually no decimals) or IDs
    if (!price) {
        console.log('No keyword price found, attempting fallback...');

        // Match numbers that definitely look like currency (2 decimals)
        // Format: 1,234.56 or 1234.56 or 1 2 3 4 . 5 6
        const potentialPrices = text.match(/(\d[\d\s,]*\.\s*\d\s*\d)/g);

        if (potentialPrices) {
            // Check candidates from end to start (total is usually at bottom)
            for (let i = potentialPrices.length - 1; i >= 0; i--) {
                const rawPrice = potentialPrices[i];
                // Clean: remove spaces and commas
                const cleanPrice = rawPrice.replace(/[\s,]+/g, '');
                const numPrice = parseFloat(cleanPrice);

                // Extra validation for fallback
                // 1. Must be valid number
                // 2. Must not be too large (likely not an ID/phone if it has decimals)
                // 3. Must be reasonable amount (> 50)
                if (!isNaN(numPrice) && numPrice > 50 && numPrice < 500000) {

                    // Double check it's not a phone number masquerading (though decimals usually prevent this)
                    // If it has a comma, it's very likely a price
                    const hasComma = rawPrice.includes(',');
                    // If it follows 'Rs' or 'INR' or symbol
                    const indexInText = text.lastIndexOf(rawPrice);
                    const precedingText = text.substring(Math.max(0, indexInText - 20), indexInText);
                    const hasCurrencySymbol = /R\s*s|I\s*N\s*R|₹/.test(precedingText);

                    if (hasComma || hasCurrencySymbol || i === potentialPrices.length - 1) {
                        price = '₹' + cleanPrice;
                        console.log('Found Price via Fallback:', price, 'Raw:', rawPrice);
                        break;
                    }
                }
            }
        }
    }

    // Item name - look for product description
    let itemName = '';
    // Match "Vonue" or similar product names
    const itemMatch = text.match(/V\s*o\s*[e|n]\s*u\s*x?[^|]{10,80}/i);
    if (itemMatch) {
        itemName = itemMatch[0].replace(/\s+/g, '').trim(); // Remove ALL spaces
        console.log('Found Item:', itemName);
    }

    // Address - look for "Name:" followed by name and location
    let deliveryAddress = '';
    let addressContext = ''; // Keep raw address for state extraction
    // More flexible pattern to match spaced text - capture everything after "Name:" until we hit a state or pincode
    const addressMatch = text.match(/N\s*a\s*m\s*e\s*:\s*(.{10,200}?)(?=\s*(?:I\s*N\s*-)|$)/i);
    if (addressMatch) {
        addressContext = addressMatch[1];
        // Clean up the address - remove extra spaces but keep structure
        deliveryAddress = addressMatch[1]
            .replace(/\s+/g, '')  // Remove ALL spaces first
            .replace(/,/g, ', ')  // Add space after commas for readability
            .trim()
            .substring(0, 200); // Limit length
        console.log('Found Address:', deliveryAddress);
    }

    // State - look for state names in the address context first, then in full text
    let deliveryState = '';
    const statePatterns = [
        { pattern: /A\s*s\s*s\s*a\s*m/i, name: 'Assam' },
        { pattern: /W\s*e\s*s\s*t\s*B\s*e\s*n\s*g\s*a\s*l/i, name: 'WestBengal' },
        { pattern: /M\s*a\s*h\s*a\s*r\s*a\s*s\s*h\s*t\s*r\s*a/i, name: 'Maharashtra' },
        { pattern: /K\s*a\s*r\s*n\s*a\s*t\s*a\s*k\s*a/i, name: 'Karnataka' },
        { pattern: /T\s*a\s*m\s*i\s*l\s*N\s*a\s*d\s*u/i, name: 'TamilNadu' },
        { pattern: /G\s*u\s*j\s*a\s*r\s*a\s*t/i, name: 'Gujarat' },
        { pattern: /D\s*e\s*l\s*h\s*i/i, name: 'Delhi' },
        { pattern: /B\s*i\s*h\s*a\s*r/i, name: 'Bihar' },
        { pattern: /U\s*t\s*t\s*a\s*r\s*P\s*r\s*a\s*d\s*e\s*s\s*h/i, name: 'UttarPradesh' },
    ];

    // First try to find state in the address context
    for (const { pattern, name } of statePatterns) {
        const match = addressContext.match(pattern);
        if (match) {
            deliveryState = name;
            console.log('Found State in address:', deliveryState);
            break;
        }
    }

    // If not found, check if address contains city names that indicate state
    if (!deliveryState && addressContext) {
        const cityStateMap = [
            { cities: /H\s*o\s*j\s*a\s*i/i, state: 'Assam' },
            { cities: /K\s*o\s*l\s*k\s*a\s*t\s*a|C\s*a\s*l\s*c\s*u\s*t\s*t\s*a/i, state: 'WestBengal' },
            { cities: /M\s*u\s*m\s*b\s*a\s*i|P\s*u\s*n\s*e/i, state: 'Maharashtra' },
        ];

        for (const { cities, state } of cityStateMap) {
            if (addressContext.match(cities)) {
                deliveryState = state;
                console.log('Found State from city:', deliveryState);
                break;
            }
        }
    }

    // If still not found in address, search full text
    if (!deliveryState) {
        for (const { pattern, name } of statePatterns) {
            const match = text.match(pattern);
            if (match) {
                deliveryState = name;
                console.log('Found State in text:', deliveryState);
                break;
            }
        }
    }

    const result = {
        orderId: orderId || 'N/A',
        date: date || 'N/A',
        price: price || 'N/A',
        itemName: itemName || 'N/A',
        deliveryAddress: deliveryAddress || 'N/A',
        deliveryState: deliveryState || 'N/A',
    };

    console.log('Final extracted data:', result);
    return result;
}
