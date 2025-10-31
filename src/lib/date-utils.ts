/**
 * Date utility functions for consistent date formatting across the admin portal
 */

/**
 * Formats a date to yyyy-MM-dd format (default for admin portal)
 * @param date - Date string, Date object, or null/undefined
 * @returns Formatted date string or empty string if invalid
 */
export function formatAdminDate(date: string | Date | null | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return '';
    }

    return dateObj.toISOString().split('T')[0]; // Returns yyyy-MM-dd format
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Formats a date to yyyy-MM-dd HH:mm format for datetime display
 * @param date - Date string, Date object, or null/undefined
 * @returns Formatted datetime string or empty string if invalid
 */
export function formatAdminDateTime(date: string | Date | null | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return '';
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return '';
  }
}

/**
 * Formats a date with custom format (use only when explicitly needed)
 * @param date - Date string, Date object, or null/undefined
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string or empty string if invalid
 */
export function formatCustomDate(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return '';
    }

    return dateObj.toLocaleDateString(undefined, options);
  } catch (error) {
    console.error('Error formatting custom date:', error);
    return '';
  }
}

/**
 * Formats a date to dd-MMM hh:mm format for leads table display
 * @param date - Date string, Date object, or null/undefined
 * @returns Formatted date string (e.g., "30-Oct 14:35") or empty string if invalid
 */
export function formatLeadsDate(date: string | Date | null | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return '';
    }

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    return `${day}-${month} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting leads date:', error);
    return '';
  }
}
