/**
 * Lead data normalization utilities for email marketing campaigns.
 *
 * Provides provider-aware email normalization and proper name capitalization
 * to ensure data consistency and avoid duplicate leads.
 */

/**
 * Normalizes an email address using provider-aware rules.
 *
 * Rules applied:
 * 1. Always lowercase the entire email
 * 2. Remove "+tag" suffix for Gmail and Microsoft/Outlook addresses (plus-addressing)
 * 3. Remove dots in local part for Gmail/Googlemail only (Gmail ignores dots)
 *
 * @param email - The raw email address to normalize
 * @returns The normalized email address
 *
 * @example
 * normalizeEmail('André.Silva+tag@gmail.com') // => 'andresilva@gmail.com'
 * normalizeEmail('User+Tag@outlook.com') // => 'user@outlook.com'
 * normalizeEmail('user.name+test@otherdomain.com') // => 'user.name@otherdomain.com'
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  // Step 1: Lowercase the entire email
  const normalized = email.trim().toLowerCase();

  // Split into local part and domain
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex === -1) {
    return normalized; // Invalid email, return as-is
  }

  let localPart = normalized.substring(0, atIndex);
  const domain = normalized.substring(atIndex + 1);

  // Step 2: Remove "+tag" suffix for providers that support plus-addressing
  // Gmail, Googlemail, Outlook, Hotmail, Live, and Microsoft domains support this
  const plusAddressingDomains = [
    'gmail.com',
    'googlemail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
  ];

  if (plusAddressingDomains.includes(domain)) {
    const plusIndex = localPart.indexOf('+');
    if (plusIndex !== -1) {
      localPart = localPart.substring(0, plusIndex);
    }
  }

  // Step 3: Remove dots in local part for Gmail/Googlemail only
  // Gmail ignores dots in email addresses (user.name@gmail.com === username@gmail.com)
  const dotIgnoringDomains = ['gmail.com', 'googlemail.com'];
  if (dotIgnoringDomains.includes(domain)) {
    localPart = localPart.replace(/\./g, '');
  }

  return `${localPart}@${domain}`;
}

/**
 * Normalizes a person's name to proper title case with smart handling of
 * particles, connectors, and special characters.
 *
 * Rules applied:
 * 1. Lowercase the entire name
 * 2. Capitalize the first letter of each word
 * 3. Keep common particles and connectors lowercase (da, de, do, dos, das, e, van, von, etc.)
 * 4. Handle accented characters correctly
 * 5. Preserve hyphens in compound names
 *
 * @param name - The raw name to normalize
 * @returns The normalized name in proper title case
 *
 * @example
 * normalizeName('andré jácome PEREira da SILVA') // => 'André Jácome Pereira da Silva'
 * normalizeName('MARIA DE LOURDES') // => 'Maria de Lourdes'
 * normalizeName('jean-paul SARTRE') // => 'Jean-Paul Sartre'
 * normalizeName('LUDWIG van BEETHOVEN') // => 'Ludwig van Beethoven'
 */
export function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // Trim and normalize whitespace
  const trimmedName = name.trim().replace(/\s+/g, ' ');

  // Common particles and connectors that should remain lowercase
  // (unless they're the first word in the name)
  const lowercaseParticles = new Set([
    'da',
    'de',
    'do',
    'dos',
    'das',
    'del',
    'della',
    'di',
    'du',
    'e',
    'la',
    'las',
    'le',
    'los',
    'van',
    'von',
    'zu',
    'y',
  ]);

  // Split by spaces and process each word
  const words = trimmedName.toLowerCase().split(' ');

  const normalizedWords = words.map((word, index) => {
    // Handle empty strings
    if (!word) {
      return word;
    }

    // Check if this is a particle that should stay lowercase
    // (but capitalize if it's the first word)
    if (index > 0 && lowercaseParticles.has(word)) {
      return word;
    }

    // Handle hyphenated compound names (e.g., "jean-paul")
    if (word.includes('-')) {
      return word
        .split('-')
        .map((part) => capitalizeFirstLetter(part))
        .join('-');
    }

    // Capitalize first letter of regular words
    return capitalizeFirstLetter(word);
  });

  return normalizedWords.join(' ');
}

/**
 * Capitalizes the first letter of a string, preserving the rest as-is.
 * Handles accented characters correctly.
 *
 * @param str - The string to capitalize
 * @returns The string with first letter capitalized
 */
function capitalizeFirstLetter(str: string): string {
  if (!str || str.length === 0) {
    return str;
  }

  // Use locale-aware capitalization to handle accented characters
  return str.charAt(0).toLocaleUpperCase() + str.slice(1);
}

/**
 * Validates that a language code follows the expected format (e.g., 'pt-PT', 'en-US').
 *
 * @param language - The language code to validate
 * @returns True if valid, false otherwise
 *
 * @example
 * isValidLanguageCode('pt-PT') // => true
 * isValidLanguageCode('en-US') // => true
 * isValidLanguageCode('invalid') // => false
 */
export function isValidLanguageCode(language: string): boolean {
  if (!language || typeof language !== 'string') {
    return false;
  }

  // Match format like 'pt-PT', 'en-US', 'es-ES'
  const languageCodePattern = /^[a-z]{2}-[A-Z]{2}$/;
  return languageCodePattern.test(language);
}

/**
 * Validates that an email address has a basic valid format.
 *
 * @param email - The email to validate
 * @returns True if the email has a valid format, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email validation pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}
