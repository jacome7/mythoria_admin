export const luluShippingLimits = { name: 35, address: 30, phone: 20, taxId: 40 };
export const luluPhonePattern = /^\+?[\d\s\-./()]{8,20}$/;
const shortSubdivision = /^[A-Z0-9]{1,3}$/i;
const spanishSubdivisionName = /^\p{L}[\p{L}\p{M} .'/()-]{3,29}$/u;

// Lulu's shipping-options endpoint requires a short subdivision code in these markets.
const subdivisionCountries = new Set([
  'AE',
  'AS',
  'AU',
  'BR',
  'CA',
  'CN',
  'CO',
  'CR',
  'KY',
  'ES',
  'FM',
  'HK',
  'HN',
  'ID',
  'IN',
  'IQ',
  'IT',
  'JM',
  'JP',
  'KN',
  'KR',
  'MX',
  'MH',
  'MP',
  'NR',
  'PW',
  'PG',
  'PF',
  'RU',
  'SV',
  'SO',
  'TW',
  'UM',
  'US',
  'VE',
  'VI',
]);

export function luluRequiresTaxId(country: string) {
  return ['BR', 'CL', 'MX'].includes(country);
}

export function luluRequiresSubdivision(country: string) {
  return subdivisionCountries.has(country);
}

export function luluAddressIssue(shipping: {
  street1: string;
  street2?: string;
  city: string;
  country_code: string;
  postcode: string;
  state_code?: string;
}) {
  if (
    [shipping.street1, shipping.street2, shipping.city].some(
      (part) => (part?.trim().length ?? 0) > luluShippingLimits.address,
    )
  )
    return 'addressTooLong';
  if (!shipping.postcode.trim()) return 'postalCodeRequired';
  const subdivision = shipping.state_code?.trim() ?? '';
  if (
    luluRequiresSubdivision(shipping.country_code) &&
    !shortSubdivision.test(subdivision) &&
    !(shipping.country_code === 'ES' && spanishSubdivisionName.test(subdivision))
  )
    return shipping.country_code === 'ES' ? 'spanishProvinceRequired' : 'subdivisionRequired';
  return undefined;
}

export function luluContactIssue(shipping: {
  name: string;
  phone_number: string;
  country_code: string;
  recipient_tax_id?: string;
}) {
  if (shipping.name.length > luluShippingLimits.name) return 'nameTooLong';
  if (
    shipping.phone_number.length > luluShippingLimits.phone ||
    !luluPhonePattern.test(shipping.phone_number)
  )
    return 'phoneInvalid';
  if (
    luluRequiresTaxId(shipping.country_code) &&
    (!shipping.recipient_tax_id || shipping.recipient_tax_id.length > luluShippingLimits.taxId)
  )
    return 'taxIdRequired';
  return undefined;
}

export const luluShippingIssueMessages = {
  addressTooLong: 'Use at most 30 characters for the city and each shipping address line.',
  postalCodeRequired: 'Enter the postal code for the shipping address.',
  spanishProvinceRequired: 'Enter the province name or short code for the shipping address.',
  subdivisionRequired: 'Enter the short state, province, or region code for the shipping address.',
  nameTooLong: 'Use at most 35 characters for the shipping recipient name.',
  phoneInvalid: 'Enter a carrier phone number using 8 to 20 characters.',
  taxIdRequired: 'Enter the recipient tax ID for this destination.',
};

export function normalizeShippingSubdivision(country: string, state?: string) {
  return country === 'ES' && state && state.length > 3 ? state : state?.toUpperCase();
}
