'use client';

import { useId, useState } from 'react';
import { subdivisionLabel, subdivisionOptions } from '@/lib/print-delivery/delivery-regions';
import {
  luluRequiresSubdivision,
  luluRequiresTaxId,
  luluShippingLimits,
} from '@/lib/print-delivery/lulu-shipping';
import {
  emptyAdminPrintDelivery,
  staffDestinationAddressSchema,
  type AdminLuluShippingDefaults,
  type AdminPrintDeliverySource,
  type AdminPrintDeliveryValue,
  type StaffPrintDestination,
} from '@/lib/print-delivery/shipping';

export { emptyAdminPrintDelivery, parseAdminPrintShipping } from '@/lib/print-delivery/shipping';
export type {
  AdminLuluShippingDefaults,
  AdminPrintDeliveryValue,
} from '@/lib/print-delivery/shipping';

const endpoint = '/api/tickets/print-destinations';
const locale = 'en-US';
const countryNames = new Intl.DisplayNames(locale, { type: 'region', fallback: 'none' });
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const countries = alphabet
  .flatMap((first) => alphabet.map((last) => first + last))
  .map((value) => ({ label: countryNames.of(value), value }))
  .filter((country): country is { label: string; value: string } => Boolean(country.label))
  .sort((a, b) => a.label.localeCompare(b.label, locale));
const regionLabels = {
  provinceTerritory: 'Province or territory',
  province: 'Province',
  state: 'State',
  region: 'Region',
};

interface AddressFieldsProps {
  shipping: AdminLuluShippingDefaults;
  onChange: (shipping: AdminLuluShippingDefaults) => void;
  provider: 'lulu' | 'manual';
  addressLocked?: boolean;
  showTax?: boolean;
  taxIdOnFile?: boolean;
}

export function AdminPrintAddressFields({
  shipping,
  onChange,
  provider,
  addressLocked = false,
  showTax = true,
  taxIdOnFile = false,
}: AddressFieldsProps) {
  const [expandLine2, setExpandLine2] = useState(false);
  const fieldId = useId();
  const country = shipping.country_code?.toUpperCase() ?? '';
  const isLulu = provider === 'lulu';
  const requiresRegion = isLulu && luluRequiresSubdivision(country);
  const requiresTax = showTax && isLulu && luluRequiresTaxId(country);
  const regions = subdivisionOptions(country, locale);
  const currentRegion = shipping.state_code ?? '';
  const showRegion = requiresRegion || !isLulu || Boolean(currentRegion);

  function field(
    key: keyof AdminLuluShippingDefaults,
    label: string,
    maxLength: number,
    options: { required?: boolean; type?: string; autoComplete?: string } = {},
  ) {
    const { required, type = 'text', autoComplete } = options;
    return (
      <label className="grid gap-1 text-sm">
        <span>{label}</span>
        <input
          className="input input-bordered input-sm w-full"
          name={key}
          type={type}
          maxLength={maxLength}
          required={required}
          autoComplete={autoComplete}
          readOnly={addressLocked && key !== 'recipient_tax_id'}
          value={shipping[key] ?? ''}
          onChange={(event) => onChange({ ...shipping, [key]: event.target.value })}
        />
      </label>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm sm:col-span-2">
        <span>Country</span>
        <select
          className="select select-bordered select-sm w-full"
          autoComplete="shipping country"
          value={country}
          required
          disabled={addressLocked}
          onChange={(event) =>
            onChange({
              ...shipping,
              country_code: event.target.value,
              state_code: '',
              recipient_tax_id: '',
            })
          }
        >
          <option value="">Choose a country</option>
          {country && !countries.some(({ value }) => value === country) && (
            <option value={country}>{country}</option>
          )}
          {countries.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {(country || addressLocked) && (
        <>
          {field('name', 'Ship-to recipient', isLulu ? luluShippingLimits.name : 120, {
            required: true,
            autoComplete: 'shipping name',
          })}
          {field('email', 'Recipient email', 255, {
            required: true,
            type: 'email',
            autoComplete: 'shipping email',
          })}
          {field('phone_number', 'Carrier phone', isLulu ? luluShippingLimits.phone : 30, {
            required: true,
            type: 'tel',
            autoComplete: 'shipping tel',
          })}
          {field('street1', 'Street address', isLulu ? luluShippingLimits.address : 255, {
            required: true,
            autoComplete: 'shipping address-line1',
          })}
          {expandLine2 || shipping.street2
            ? field(
                'street2',
                'Apartment, suite, or other details (optional)',
                isLulu ? luluShippingLimits.address : 255,
                {
                  autoComplete: 'shipping address-line2',
                },
              )
            : !addressLocked && (
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    className="link text-sm"
                    onClick={() => setExpandLine2(true)}
                  >
                    Add address line 2
                  </button>
                </div>
              )}
          {field('city', 'City', isLulu ? luluShippingLimits.address : 120, {
            required: true,
            autoComplete: 'shipping address-level2',
          })}
          {showRegion && (
            <label className="grid gap-1 text-sm">
              <span>{regionLabels[subdivisionLabel(country)]}</span>
              <input
                className="input input-bordered input-sm w-full"
                name="state_code"
                autoComplete="shipping address-level1"
                value={currentRegion}
                list={regions.length ? `${fieldId}-regions` : undefined}
                maxLength={requiresRegion && country !== 'ES' ? 3 : isLulu ? 30 : 120}
                readOnly={addressLocked}
                required={requiresRegion}
                onChange={(event) => onChange({ ...shipping, state_code: event.target.value })}
              />
              {regions.length > 0 && (
                <datalist id={`${fieldId}-regions`}>
                  {regions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </datalist>
              )}
            </label>
          )}
          {field('postcode', 'Postal code', 20, {
            required: isLulu,
            autoComplete: 'shipping postal-code',
          })}
          {requiresTax && (
            <div className="space-y-1">
              {field('recipient_tax_id', 'Recipient tax ID', luluShippingLimits.taxId, {
                required: !taxIdOnFile,
                type: 'password',
                autoComplete: 'off',
              })}
              {taxIdOnFile && (
                <p className="text-xs text-base-content/70">
                  Leave blank to retain the tax ID on file.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface AdminPrintDeliveryProps {
  value: AdminPrintDeliveryValue;
  onChange: (value: AdminPrintDeliveryValue) => void;
  customerAddress?: AdminLuluShippingDefaults;
  legacyAddress?: AdminLuluShippingDefaults;
  purchaser?: string;
  proofRecipient?: string;
  provider: 'lulu' | 'manual';
  busy?: boolean;
}

export function AdminPrintDelivery({
  value,
  onChange,
  customerAddress,
  legacyAddress,
  purchaser,
  proofRecipient,
  provider,
  busy = false,
}: AdminPrintDeliveryProps) {
  const [destinations, setDestinations] = useState<StaffPrintDestination[] | null>(null);
  const [destinationBusy, setDestinationBusy] = useState(false);
  const [destinationError, setDestinationError] = useState<string>();
  const [label, setLabel] = useState('');
  const customer = legacyAddress ?? customerAddress;
  const isStaff = value.source === 'staff_saved';
  const saved = isStaff && Boolean(value.staffDestinationId);

  async function loadDestinations() {
    setDestinationBusy(true);
    setDestinationError(undefined);
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load saved staff destinations.');
      const data = (await response.json()) as { destinations: StaffPrintDestination[] };
      setDestinations(data.destinations);
    } catch (error) {
      setDestinationError(
        error instanceof Error ? error.message : 'Could not load saved staff destinations.',
      );
    } finally {
      setDestinationBusy(false);
    }
  }

  async function saveDestination() {
    const address = staffDestinationAddressSchema.safeParse({
      ...value.shipping,
      postcode: value.shipping.postcode ?? '',
    });
    if (!address.success || !label.trim()) {
      setDestinationError('Enter a label and valid staff delivery details.');
      return;
    }
    setDestinationBusy(true);
    setDestinationError(undefined);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, address: address.data }),
      });
      const data = (await response.json()) as {
        destination?: StaffPrintDestination;
        error?: string;
      };
      if (!response.ok || !data.destination)
        throw new Error(data.error ?? 'Could not save the staff destination.');
      const destination = data.destination;
      setDestinations((previous) => [destination, ...(previous ?? [])]);
      setLabel('');
      onChange({
        source: 'staff_saved',
        staffDestinationId: destination.id,
        shipping: destination.address,
      });
    } catch (error) {
      setDestinationError(
        error instanceof Error ? error.message : 'Could not save the staff destination.',
      );
    } finally {
      setDestinationBusy(false);
    }
  }

  async function removeDestination(id: string) {
    if (!confirm('Remove this address from your saved staff destinations?')) return;
    setDestinationBusy(true);
    setDestinationError(undefined);
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error('Could not remove the staff destination.');
      setDestinations((previous) =>
        (previous ?? []).filter((destination) => destination.id !== id),
      );
      onChange({ source: 'staff_saved', shipping: {} });
    } catch (error) {
      setDestinationError(
        error instanceof Error ? error.message : 'Could not remove the staff destination.',
      );
    } finally {
      setDestinationBusy(false);
    }
  }

  return (
    <fieldset className="space-y-3" disabled={busy || destinationBusy}>
      <legend className="font-medium">Delivery details</legend>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Purchaser</dt>
          <dd>{purchaser || 'Staff order'}</dd>
        </div>
        <div>
          <dt className="font-medium">Proof reviewer</dt>
          <dd>{proofRecipient || 'Print team, on this ticket'}</dd>
        </div>
      </dl>
      <label className="grid gap-1 text-sm">
        <span>Delivery address source</span>
        <select
          className="select select-bordered select-sm w-full"
          value={value.source}
          required
          onChange={(event) => {
            const source = event.target.value as AdminPrintDeliverySource;
            setDestinationError(undefined);
            onChange(
              source
                ? { source, shipping: source === 'customer_confirmed' ? (customer ?? {}) : {} }
                : emptyAdminPrintDelivery,
            );
            if (source === 'staff_saved' && destinations === null) void loadDestinations();
          }}
        >
          <option value="">Choose a delivery address source</option>
          <option value="staff_saved">Saved staff destination</option>
          <option value="customer_confirmed">Confirmed customer address</option>
          <option value="someone_else">Someone else</option>
        </select>
      </label>
      {value.source === 'customer_confirmed' && (
        <p className="text-sm text-base-content/70">
          {legacyAddress
            ? 'Address from the original order.'
            : customerAddress
              ? 'Address from the customer’s address book.'
              : 'Enter the delivery address confirmed by the customer.'}{' '}
          Check that it belongs to the intended recipient.
        </p>
      )}
      {isStaff && (
        <div className="space-y-2">
          {destinationBusy && (
            <p role="status" className="text-sm">
              Working with saved destinations…
            </p>
          )}
          <label className="grid gap-1 text-sm">
            <span>My staff destinations</span>
            <select
              className="select select-bordered select-sm w-full"
              value={value.staffDestinationId ?? ''}
              onChange={(event) => {
                const destination = destinations?.find(({ id }) => id === event.target.value);
                onChange({
                  source: 'staff_saved',
                  ...(destination ? { staffDestinationId: destination.id } : {}),
                  shipping: destination?.address ?? {},
                });
              }}
            >
              <option value="">Add a staff destination</option>
              {destinations?.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {value.staffDestinationId && (
            <button
              type="button"
              className="link text-sm"
              onClick={() => void removeDestination(value.staffDestinationId!)}
            >
              Remove saved destination
            </button>
          )}
        </div>
      )}
      {value.source && (
        <AdminPrintAddressFields
          key={`${value.source}:${value.staffDestinationId ?? ''}`}
          shipping={value.shipping}
          provider={provider}
          onChange={(shipping) => onChange({ ...value, shipping })}
          addressLocked={saved}
          showTax={!isStaff || saved}
        />
      )}
      {isStaff && !saved && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span>Staff destination label</span>
            <input
              className="input input-bordered input-sm"
              value={label}
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => void saveDestination()}
          >
            Save staff destination
          </button>
        </div>
      )}
      {destinationError && (
        <p role="alert" className="text-sm text-error">
          {destinationError}
        </p>
      )}
    </fieldset>
  );
}
