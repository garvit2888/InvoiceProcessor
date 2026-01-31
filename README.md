# InvoiceFlow - Automated Invoice Processing

A modern web application that automatically extracts data from invoice PDFs and logs it to Google Sheets. Built with Next.js 14, TypeScript, and deployed on Vercel.

## Features

- 📄 **PDF Upload**: Drag-and-drop interface for easy invoice uploads
- 🤖 **Automatic Extraction**: Extracts date, price, item name, delivery address, and state
- 📊 **Google Sheets Integration**: Automatically logs data to your Google Sheet
- 🎨 **Modern UI**: Beautiful, responsive design with animations
- ⚡ **Fast & Reliable**: Built with Next.js for optimal performance

## Setup Instructions

### 1. Clone and Install

```bash
cd /Users/garvit/Documents/WhatsappAutomation/invoice-processor
npm install
```

### 2. Google Sheets API Setup

#### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

#### Step 2: Create Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details:
   - Name: `invoice-processor`
   - Description: `Service account for invoice processing`
4. Click "Create and Continue"
5. Skip the optional steps and click "Done"

#### Step 3: Generate Credentials

1. Click on the service account you just created
2. Go to the "Keys" tab
3. Click "Add Key" > "Create New Key"
4. Select "JSON" format
5. Click "Create" - this will download a JSON file

#### Step 4: Create Google Sheet

1. Create a new Google Sheet or use an existing one
2. Copy the Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
   ```
3. Share the sheet with the service account email:
   - Open the JSON credentials file
   - Find the `client_email` field
   - Share your Google Sheet with this email address (Editor access)

### 3. Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   GOOGLE_CREDENTIALS={"type":"service_account",...}
   GOOGLE_SHEET_ID=your_sheet_id_here
   ```

   **Important**: 
   - For `GOOGLE_CREDENTIALS`, copy the entire content of the downloaded JSON file as a single line
   - For `GOOGLE_SHEET_ID`, use the ID from your Google Sheet URL

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Deployment to Vercel

### 1. Install Vercel CLI (optional)

```bash
npm install -g vercel
```

### 2. Deploy

```bash
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

### 3. Set Environment Variables in Vercel

1. Go to your project settings in Vercel
2. Navigate to "Environment Variables"
3. Add the following variables:
   - `GOOGLE_CREDENTIALS`: Paste the entire JSON credentials
   - `GOOGLE_SHEET_ID`: Your Google Sheet ID

### 4. Redeploy

After adding environment variables, trigger a new deployment.

## Usage

1. Navigate to the "Upload Invoice" page
2. Drag and drop your invoice PDF or click to browse
3. Wait for the system to process the invoice
4. View the extracted data
5. Check your Google Sheet - a new row will be added with the invoice data

## Google Sheet Structure

The application will create/use the following columns:

| Date | Price | Item Name | Delivery Address | State | Logged At |
|------|-------|-----------|------------------|-------|-----------|
| ... | ... | ... | ... | ... | ... |

## Troubleshooting

### "Failed to append data to Google Sheet"

- Verify that you've shared the Google Sheet with the service account email
- Check that the `GOOGLE_SHEET_ID` is correct
- Ensure the `GOOGLE_CREDENTIALS` JSON is valid

### "Could not extract all required fields"

- The invoice PDF might have an unusual format
- Try with a different invoice PDF
- Check that the PDF contains text (not just images)

### PDF Upload Fails

- Ensure the file is a valid PDF
- Check that the file size is under 10MB
- Verify your internet connection

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: CSS Modules with custom design system
- **PDF Parsing**: pdf-parse
- **Google Sheets**: googleapis
- **File Upload**: react-dropzone
- **Deployment**: Vercel

## License

MIT

## Support

For issues or questions, please open an issue on the repository.
