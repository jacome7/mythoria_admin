# CSV Import for Leads

## Overview

The Leads Management page (`/leads`) includes a CSV import feature that allows bulk uploading of email marketing leads. This document describes the format, validation rules, and error handling.

## Accessing the Feature

1. Navigate to **Leads** in the admin portal sidebar
2. Click the **Upload CSV** button in the top-right corner
3. Select a CSV file from your computer
4. Wait for the upload to complete
5. Review the import results banner

## CSV Format Requirements

### Required Column

- **`email`** (string, required): Valid email address
  - Must be unique (duplicates will be skipped)
  - Will be normalized to lowercase
  - Must match email format: `user@domain.com`

### Optional Columns

- **`name`** (string, optional): Lead's full name
  - **Automatically normalized to proper title case**
  - Lowercase particles preserved (da, de, do, van, von, etc.)
  - Handles accented characters correctly
  - **Enclose in quotes if name contains commas** (e.g., `"Doe, John"`)
  - Examples:
    - `Miguel COSTA` → `Miguel Costa`
    - `andré jácome PEREira da SILVA` → `André Jácome Pereira da Silva`
    - `MARIA DE LOURDES` → `Maria de Lourdes`
    - `jean-paul SARTRE` → `Jean-Paul Sartre`

- **`mobile_phone`** (string, optional): Phone number in any format
  - Alternative column names: `mobilephone`, `phone`
  - Example: `+1-555-0100`, `+351912345678`

- **`language`** (string, optional): Language preference
  - Format: IETF language tags (e.g., `en-US`, `pt-PT`, `es-ES`, `fr-FR`)
  - Defaults to `en-US` if not provided

### CSV Formatting Rules

1. **Quoted Fields**: Enclose fields in double quotes if they contain:
   - Commas: `"Santos, Jr."`
   - Line breaks: `"Multi\nLine"`
   - Double quotes: Use `""` to escape quotes inside quoted fields

2. **Header Row**: First row must contain column names (case-insensitive)

3. **Consistent Columns**: All rows must have the same number of columns as the header

4. **Character Encoding**: UTF-8 recommended for special characters

## Sample CSV

```csv
email,name,mobile_phone,language
john.doe@example.com,"John Doe",+1-555-0100,en-US
jane.smith@example.com,"Jane Smith",+1-555-0101,en-US
carlos.silva@example.com,"Carlos Silva",+351-912-345-678,pt-PT
marie.dupont@example.com,"Marie Dupont",+33-6-12-34-56-78,fr-FR
maria.garcia@example.com,"María García",+34-612-345-678,es-ES
pedro.santos@example.com,"Pedro Santos, Jr.",+351-913-456-789,pt-PT
```

**Note**: Names are enclosed in quotes to handle special characters and commas properly.

A sample file is available at: `mythoria_admin/docs/leads-import-sample.csv`

## Validation Rules

### Email Validation & Normalization

- **Format Check**: Must match pattern `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Uniqueness**: Checked against existing leads in database (after normalization)
- **Normalization Rules**:
  - Converted to lowercase
  - Gmail/Googlemail: Removes dots from local part and "+tag" suffixes
  - Outlook/Hotmail/Live: Removes "+tag" suffixes
  - Example: `André.Silva+tag@gmail.com` → `andresilva@gmail.com`

### Name Normalization

- **Title Case**: First letter of each word capitalized
- **Particles**: Common particles remain lowercase (da, de, do, van, von, etc.) unless first word
- **Hyphens**: Preserved in compound names (e.g., `Jean-Paul`)
- **Accents**: Properly handled (e.g., `André`, `María`)
- Applied automatically during import

### Row Processing

- **Header Row**: First row must contain column names
- **Data Rows**: All subsequent rows are processed
- **Malformed Rows**: Rows with incorrect column count are skipped silently
- **Empty Values**: Optional fields can be empty or omitted

## Import Results

After upload completes, a banner displays:

### Success Information
- **Leads Imported**: Count of successfully inserted leads
- **Duplicates Skipped**: Count of emails already in database

### Error Details
- **Errors List**: First 5 errors shown inline (expandable)
- **Error Format**: `Row N: Error description`

### Common Errors

1. **Missing Email**
   ```
   Row 5: Missing email
   ```
   Solution: Ensure every row has an email value

2. **Invalid Email Format**
   ```
   Row 8: Invalid email format: not-an-email
   ```
   Solution: Fix email to match `user@domain.com` pattern

3. **Database Errors**
   ```
   Row 12: Failed to insert user@example.com
   ```
   Solution: Check database connectivity and permissions

## API Endpoint

### `POST /api/admin/leads/import`

**Authentication**: Required (NextAuth session + allowed domain)

**Content-Type**: `multipart/form-data`

**Request Body**:
- `file`: CSV file (must have `.csv` extension)

**Response** (200 OK):
```json
{
  "success": 45,
  "duplicates": 3,
  "errors": [
    "Row 2: Missing email",
    "Row 7: Invalid email format: bad-email"
  ]
}
```

**Response** (400 Bad Request):
```json
{
  "error": "File must be a CSV"
}
```

**Response** (401 Unauthorized):
```json
{
  "error": "Unauthorized"
}
```

**Response** (403 Forbidden):
```json
{
  "error": "Access denied. Only authorized domains can import leads."
}
```

## Technical Implementation

### File Processing Flow

1. **Authentication**: Verify NextAuth session and allowed domain
2. **File Validation**: Check file exists and has `.csv` extension
3. **Content Parsing**: Split by newlines, extract headers, parse rows with quote handling
4. **Row Iteration**: Process each row sequentially
5. **Email Validation**: Check format, normalize, and check uniqueness
6. **Name Normalization**: Apply proper title case with smart particle handling
7. **Database Insert**: Insert valid leads with default `emailStatus: 'ready'`
8. **Result Aggregation**: Count successes, duplicates, and errors

### Database Schema

Leads are inserted into the `leads` table with:

```typescript
{
  id: uuid (auto-generated),
  email: string (normalized: lowercase, provider-aware deduplication),
  name: string | null (normalized: proper title case),
  mobilePhone: string | null,
  language: string (default: 'en-US'),
  emailStatus: 'ready' (default for imports),
  lastEmailSentAt: null (initially)
}
```

### Performance Considerations

- **Sequential Processing**: Rows are processed one at a time to avoid race conditions
- **Duplicate Check**: Each email triggers a `SELECT` query before `INSERT`
- **Error Isolation**: Failed rows don't block subsequent imports
- **Memory**: Entire file content loaded into memory (suitable for files < 10 MB)

## Best Practices

### Before Upload

1. **Validate Data**: Ensure all emails are properly formatted
2. **Remove Duplicates**: Pre-process CSV to remove duplicate emails
3. **Test Small First**: Upload a small sample (5-10 rows) to verify format
4. **Check Language Codes**: Ensure language values match supported locales

### After Upload

1. **Review Results**: Check the success/error counts in the banner
2. **Fix Errors**: Download error list, correct issues, re-upload failed rows
3. **Verify in Table**: Scroll through leads list to spot-check imports
4. **Check Stats**: Visit Email Marketing page to see updated lead counts

### File Size Limits

- **Recommended**: < 1,000 rows per file
- **Maximum**: Limited by Next.js request body size (typically 4-5 MB)
- **Large Imports**: Split into multiple files if > 5,000 leads

## Troubleshooting

### "No file provided" Error

**Cause**: File picker was cancelled or file didn't upload

**Solution**: Try again, ensure file selection completes

### "File must be a CSV" Error

**Cause**: Selected file doesn't have `.csv` extension

**Solution**: Save file with `.csv` extension, not `.txt` or `.xlsx`

### "Failed to parse CSV" Error

**Cause**: CSV structure is malformed (missing header, inconsistent columns)

**Solution**: 
- Ensure first row contains column headers
- Verify all rows have same number of columns
- Remove special characters in values (or wrap in quotes)

### "CSV file must contain an 'email' column" Error

**Cause**: Header row doesn't include an `email` column

**Solution**: Rename column to `email` (case-insensitive)

### All Rows Show as Duplicates

**Cause**: Emails already exist in database

**Solution**: 
- Check Leads table for existing entries
- Clear test data via admin panel or database
- Modify emails to be unique

### No Results Banner Appears

**Cause**: JavaScript error or network failure

**Solution**:
- Check browser console for errors
- Verify network tab shows 200 response
- Refresh page and try again

## Related Documentation

- [Leads Management Page](./leads-management.md)
- [Email Marketing Dashboard](./email-marketing-dashboard.md)
- [API Reference: Leads Import](../api-reference.md#post-apiadminleadsimport)
