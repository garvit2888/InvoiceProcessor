import { NextResponse } from 'next/server';
import { getInvoiceLogs } from '@/lib/googleSheets';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic'; // Static generation won't work for cron

export async function GET(request: Request) {
    // Basic security check (Vercel Cron automatically adds this header)
    const authHeader = request.headers.get('authorization');

    try {
        console.log('Starting daily report generation...');

        // 1. Fetch Logs
        const logs = await getInvoiceLogs();

        if (!logs || logs.length < 2) {
            return NextResponse.json({ message: 'No data found to report.' });
        }

        const headers = logs[0];
        const dataRows = logs.slice(1);

        // 2. Filter for Yesterday (assuming 12:00 AM IST execution)
        const now = new Date();
        const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

        const yesterday = new Date(istNow);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

        console.log(`Filtering for date: ${yesterdayStr} (IST)`);

        const dailyRows = dataRows.filter(row => {
            const loggedAt = row[7];
            if (!loggedAt) return false;

            const logDate = new Date(loggedAt);
            const logIstDate = new Date(logDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            const logDateStr = logIstDate.toISOString().split('T')[0];

            return logDateStr === yesterdayStr;
        });

        if (dailyRows.length === 0) {
            console.log('No invoices found for yesterday.');
            return NextResponse.json({ message: 'No invoices logged yesterday.' });
        }

        console.log(`Found ${dailyRows.length} invoices.`);

        // 3. Generate CSV
        const csvHeader = headers.join(',') + '\n';
        const csvRows = dailyRows.map(row =>
            row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        const csvContent = csvHeader + csvRows;

        // DEBUG: Check credentials existence
        const emailUser = process.env.EMAIL_USER;
        const rawPass = process.env.EMAIL_PASS;

        if (!emailUser || !rawPass) {
            // SAFE DEBUG: List keys only
            const envKeys = Object.keys(process.env).filter(key => key.includes('EMAIL'));

            console.error('Missing credentials');
            return NextResponse.json({
                error: 'Credentials Missing in Environment',
                debug: {
                    emailUserDefined: !!emailUser,
                    emailPassDefined: !!rawPass,
                    availableEmailKeys: envKeys
                }
            });
        }

        const emailPass = rawPass.replace(/\s/g, ''); // Remove spaces

        // 4. Send Email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });

        const mailOptions = {
            from: emailUser,
            to: 'garvitarora2888@gmail.com',
            subject: `Daily Invoice Report - ${yesterdayStr}`,
            text: `Attached is the daily invoice report for ${yesterdayStr}.\n\nTotal Invoices Processed: ${dailyRows.length}`,
            attachments: [
                {
                    filename: `invoices-${yesterdayStr}.csv`,
                    content: csvContent,
                },
            ],
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully.');

        return NextResponse.json({ success: true, count: dailyRows.length });

    } catch (error) {
        console.error('Daily report error:', error);
        return NextResponse.json(
            {
                error: 'Failed (V2)',
                details: error instanceof Error ? error.message : String(error),
                debug: {
                    sheetIdDefined: !!process.env.GOOGLE_SHEET_ID,
                    sheetIdPreview: process.env.GOOGLE_SHEET_ID ? `${process.env.GOOGLE_SHEET_ID.substring(0, 5)}...` : 'N/A'
                }
            },
            { status: 500 }
        );
    }
}
