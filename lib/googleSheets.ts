import { google } from 'googleapis';
import { InvoiceData, InventoryItem, StockUpdateResult } from './types';

/**
 * Initialize Google Sheets API client
 */
function getGoogleSheetsClient() {
    const credentials = process.env.GOOGLE_CREDENTIALS;

    if (!credentials) {
        throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(credentials),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        return google.sheets({ version: 'v4', auth });
    } catch (error) {
        console.error('Error parsing Google credentials:', error);
        throw new Error('Invalid GOOGLE_CREDENTIALS format. Please check your .env file.');
    }
}

/**
 * Append invoice data to Google Sheet
 */
export async function appendToSheet(invoiceData: InvoiceData): Promise<void> {
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId) {
        throw new Error('GOOGLE_SHEET_ID environment variable is not set');
    }

    const sheets = getGoogleSheetsClient();

    // Increment sales count for the item
    let totalSold = 'N/A';
    try {
        if (invoiceData.itemName && invoiceData.itemName !== 'N/A') {
            const stockResult = await incrementSalesCount(invoiceData.itemName);
            if (stockResult.success) {
                totalSold = stockResult.newStock.toString();
            }
        }
    } catch (error) {
        console.error('Failed to update sales count:', error);
        // Continue logging invoice even if count update fails
    }

    // Prepare row data
    const values = [
        [
            invoiceData.orderId,
            invoiceData.date,
            invoiceData.price,
            invoiceData.itemName,
            invoiceData.deliveryAddress,
            invoiceData.deliveryState,
            totalSold,
            new Date().toISOString(), // Timestamp when logged
        ],
    ];

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Sheet1!A:H', // Adjusted range to include new column
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values,
            },
        });
    } catch (error) {
        console.error('Google Sheets API error:', error);
        throw new Error('Failed to append data to Google Sheet. Please check your credentials and sheet ID.');
    }
}

/**
 * Initialize sheet with headers if empty
 */
export async function initializeSheet(): Promise<void> {
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId) {
        throw new Error('GOOGLE_SHEET_ID environment variable is not set');
    }

    const sheets = getGoogleSheetsClient();

    try {
        // Check if sheet has headers
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Sheet1!A1:H1',
        });

        // If no data, add headers
        if (!response.data.values || response.data.values.length === 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: 'Sheet1!A1:H1',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [
                        ['Order ID', 'Date', 'Price', 'Item Name', 'Delivery Address', 'State', 'Total Sold', 'Logged At'],
                    ],
                },
            });
        }
    } catch (error) {
        console.error('Error initializing sheet:', error);
        // Don't throw - sheet might already have headers
    }
}

/**
 * Initialize sales sheet (formerly inventory) with headers if it doesn't exist
 */
export async function initializeSalesSheet(): Promise<void> {
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId) {
        throw new Error('GOOGLE_SHEET_ID environment variable is not set');
    }

    const sheets = getGoogleSheetsClient();

    try {
        // First, check if the Sales sheet exists (renamed from Inventory)
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
        });

        // Check for 'Sales' or fallback to 'Inventory' to avoid breaking existing
        let salesSheet = spreadsheet.data.sheets?.find(
            (sheet) => sheet.properties?.title === 'Sales'
        );

        const inventorySheet = spreadsheet.data.sheets?.find(
            (sheet) => sheet.properties?.title === 'Inventory'
        );

        // If Inventory exists but Sales doesn't we might want to rename, but for now let's just create Sales if neither exists
        // Or if 'Inventory' exists, we'll use a new 'Sales' sheet to be clean
        if (!salesSheet) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: 'Sales',
                                },
                            },
                        },
                    ],
                },
            });

            // Add headers to the new sheet
            await sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: 'Sales!A1:C1',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [['Product Name', 'Total Items Sold', 'Last Updated']],
                },
            });

            console.log('Sales sheet created with headers');
        }
    } catch (error) {
        console.error('Error initializing sales sheet:', error);
        throw new Error('Failed to initialize sales sheet');
    }
}

/**
 * Get current sales count for a product
 * Returns null if product doesn't exist
 */
export async function getProductSalesCount(productName: string): Promise<number | null> {
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId) {
        throw new Error('GOOGLE_SHEET_ID environment variable is not set');
    }

    const sheets = getGoogleSheetsClient();

    try {
        // Get all sales data
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Sales!A:C',
        });

        const rows = response.data.values;

        if (!rows || rows.length <= 1) {
            // No data or only headers
            return null;
        }

        // Find the product (skip header row)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[0] && row[0].toLowerCase() === productName.toLowerCase()) {
                return parseInt(row[1]) || 0;
            }
        }

        return null; // Product not found
    } catch (error) {
        console.error('Error getting product sales count:', error);
        throw new Error('Failed to get product sales count');
    }
}

/**
 * Increment sales count for a product
 * If product doesn't exist, creates it with initial count of 1
 */
export async function incrementSalesCount(productName: string): Promise<StockUpdateResult> {
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId) {
        throw new Error('GOOGLE_SHEET_ID environment variable is not set');
    }

    const sheets = getGoogleSheetsClient();

    try {
        // Ensure sales sheet exists
        await initializeSalesSheet();

        // Get current count
        const currentCount = await getProductSalesCount(productName);
        const timestamp = new Date().toISOString();

        if (currentCount === null) {
            // Product doesn't exist, create it with initial count of 1
            const newCount = 1;

            await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: 'Sales!A:C',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[productName, newCount, timestamp]],
                },
            });

            console.log(`Created new product in Sales: ${productName} with count: ${newCount}`);

            return {
                success: true,
                productName,
                previousStock: 0,
                newStock: newCount,
            };
        } else {
            // Product exists, increment count
            const newCount = currentCount + 1;

            // Find the row to update
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: 'Sales!A:C',
            });

            const rows = response.data.values;
            let rowIndex = -1;

            if (rows) {
                for (let i = 1; i < rows.length; i++) {
                    if (rows[i][0] && rows[i][0].toLowerCase() === productName.toLowerCase()) {
                        rowIndex = i + 1; // +1 because sheets are 1-indexed
                        break;
                    }
                }
            }

            if (rowIndex > 0) {
                // Update the count and timestamp
                await sheets.spreadsheets.values.update({
                    spreadsheetId: sheetId,
                    range: `Sales!B${rowIndex}:C${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[newCount, timestamp]],
                    },
                });

                console.log(`Updated Sales for ${productName}: ${currentCount} → ${newCount}`);

                return {
                    success: true,
                    productName,
                    previousStock: currentCount,
                    newStock: newCount,
                };
            } else {
                throw new Error('Product row not found for update');
            }
        }
    } catch (error) {
        console.error('Error updating sales count:', error);
        return {
            success: false,
            productName,
            previousStock: 0,
            newStock: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

