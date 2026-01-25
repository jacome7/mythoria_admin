'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

const partnerTypeOptions = ['printer', 'attraction', 'retail', 'other'] as const;
const partnerStatusOptions = ['active', 'draft', 'hidden'] as const;
const partnerServiceScopeOptions = ['local', 'national', 'international'] as const;

const e164Regex = /^\+[1-9]\d{6,14}$/;

const shortDescriptionSchema = z
  .record(z.string(), z.string().min(1, 'Short description entries cannot be empty.'))
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Short description must include at least one locale entry.',
  });

const partnerFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  type: z.enum(partnerTypeOptions),
  status: z.enum(partnerStatusOptions),
  logoUrl: z.string().url('Logo URL must be a valid URL.'),
  websiteUrl: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url('Website URL must be a valid URL.').optional(),
  ),
  email: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().email('Invalid email format.').optional(),
  ),
  mobilePhone: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .regex(e164Regex, 'Mobile phone must be in E.164 format (e.g., +3519xxxxxxx).')
      .optional(),
  ),
  addressLine1: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
  addressLine2: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
  city: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
  postalCode: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
  countryCode: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().length(2, 'Country code must be ISO 3166-1 alpha-2.').optional(),
  ),
  shortDescription: z.preprocess((value) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }, shortDescriptionSchema),
  serviceScope: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(partnerServiceScopeOptions).optional(),
  ),
  displayOrder: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'number') {
      return value;
    }
    return Number(value);
  }, z.number().int('Display order must be an integer.').optional()),
});

const europeanCountries = [
  { code: 'AL', name: 'Albania' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'SM', name: 'San Marino' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TR', name: 'Türkiye' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'VA', name: 'Vatican City' },
].sort((a, b) => a.name.localeCompare(b.name));

interface Partner {
  id: string;
  name: string;
  type: (typeof partnerTypeOptions)[number];
  logoUrl: string;
  websiteUrl: string | null;
  email: string | null;
  mobilePhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  countryCode: string | null;
  shortDescription: Record<string, string>;
  serviceScope: (typeof partnerServiceScopeOptions)[number] | null;
  status: (typeof partnerStatusOptions)[number];
  displayOrder: number | null;
  createdAt: string;
}

interface PartnerFormData {
  name: string;
  type: (typeof partnerTypeOptions)[number];
  status: (typeof partnerStatusOptions)[number];
  logoUrl: string;
  websiteUrl: string;
  email: string;
  mobilePhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  countryCode: string;
  shortDescription: string;
  serviceScope: string;
  displayOrder: string;
}

type ValidationResult =
  | { valid: true; parsed: z.infer<typeof partnerFormSchema> }
  | { valid: false; message: string };

const emptyFormData: PartnerFormData = {
  name: '',
  type: 'printer',
  status: 'active',
  logoUrl: '',
  websiteUrl: '',
  email: '',
  mobilePhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  countryCode: '',
  shortDescription: '{\n  "en": ""\n}',
  serviceScope: '',
  displayOrder: '',
};

export default function PartnersPage() {
  const { session, loading } = useAdminAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<PartnerFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const isPrinter = formData.type === 'printer';

  const formattedCountries = useMemo(
    () => europeanCountries.map((country) => ({ label: country.name, value: country.code })),
    [],
  );

  const fetchPartners = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/partners');
      if (response.ok) {
        const data = await response.json();
        setPartners(data.data);
      } else {
        console.error('Failed to fetch partners');
        setError('Failed to load partners');
      }
    } catch (fetchError) {
      console.error('Error fetching partners:', fetchError);
      setError('Failed to load partners');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && session?.user) {
      fetchPartners();
    }
  }, [loading, session]);

  useEffect(() => {
    if (!isPrinter && formData.serviceScope) {
      setFormData((prev) => ({ ...prev, serviceScope: '' }));
    }
  }, [isPrinter, formData.serviceScope]);

  const handleCreateNew = () => {
    setEditingPartner(null);
    setFormData(emptyFormData);
    setShowForm(true);
    setError(null);
    setJsonError(null);
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      type: partner.type,
      status: partner.status,
      logoUrl: partner.logoUrl,
      websiteUrl: partner.websiteUrl || '',
      email: partner.email || '',
      mobilePhone: partner.mobilePhone || '',
      addressLine1: partner.addressLine1 || '',
      addressLine2: partner.addressLine2 || '',
      city: partner.city || '',
      postalCode: partner.postalCode || '',
      countryCode: partner.countryCode || '',
      shortDescription: JSON.stringify(partner.shortDescription || {}, null, 2),
      serviceScope: partner.serviceScope || '',
      displayOrder: partner.displayOrder?.toString() || '',
    });
    setShowForm(true);
    setError(null);
    setJsonError(null);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingPartner(null);
    setFormData(emptyFormData);
    setError(null);
    setJsonError(null);
  };

  const validateForm = (): ValidationResult => {
    try {
      const parsed = partnerFormSchema.parse({
        ...formData,
        shortDescription: formData.shortDescription,
        serviceScope: formData.serviceScope,
        displayOrder: formData.displayOrder,
      });

      if (parsed.type !== 'printer' && parsed.serviceScope) {
        setJsonError(null);
        return {
          valid: false,
          message: 'Service scope should only be set for printer partners.',
        };
      }

      setJsonError(null);
      return { valid: true, parsed };
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const firstIssue = validationError.issues[0];
        if (firstIssue.path.includes('shortDescription')) {
          setJsonError(firstIssue.message);
          return { valid: false, message: 'Short description JSON is invalid.' };
        }
        return { valid: false, message: firstIssue.message };
      }
      return { valid: false, message: 'Validation failed.' };
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const validation = validateForm();
    if (!validation.valid) {
      setError(validation.message || 'Please fix the highlighted errors.');
      setIsSubmitting(false);
      return;
    }

    const payload = validation.parsed;
    const body = {
      ...payload,
      shortDescription: payload.shortDescription,
      serviceScope: payload.type === 'printer' ? payload.serviceScope : undefined,
    };

    try {
      const url = editingPartner
        ? `/api/admin/partners/${editingPartner.id}`
        : '/api/admin/partners';
      const method = editingPartner ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchPartners();
        handleCloseForm();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'An error occurred');
      }
    } catch (submitError) {
      console.error('Error saving partner:', submitError);
      setError('Failed to save partner');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (partner: Partner) => {
    if (!confirm(`Are you sure you want to delete ${partner.name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/partners/${partner.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchPartners();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete partner');
      }
    } catch (deleteError) {
      console.error('Error deleting partner:', deleteError);
      setError('Failed to delete partner');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <main className="container mx-auto px-4 py-8">
        <div className="bg-base-100 rounded-lg shadow-lg p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Partners</h1>
              <p className="text-sm text-base-content/70 mt-1">
                Manage the partner directory for Mythoria.
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleCreateNew}>
              + Add New Partner
            </button>
          </div>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Logo</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Country</th>
                  <th>Website</th>
                  <th>Contact</th>
                  <th>Order</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-base-content/60">
                      No partners found. Create your first partner!
                    </td>
                  </tr>
                ) : (
                  partners.map((partner) => (
                    <tr key={partner.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Image
                            src={partner.logoUrl}
                            alt={`${partner.name} logo`}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-md object-contain bg-base-200"
                          />
                        </div>
                      </td>
                      <td className="font-medium">
                        {partner.name}
                        <div className="text-xs text-base-content/60">{partner.city || '—'}</div>
                      </td>
                      <td className="capitalize">{partner.type}</td>
                      <td>
                        <span
                          className={`badge badge-sm ${
                            partner.status === 'active'
                              ? 'badge-success'
                              : partner.status === 'draft'
                                ? 'badge-warning'
                                : 'badge-ghost'
                          }`}
                        >
                          {partner.status}
                        </span>
                      </td>
                      <td>{partner.countryCode || '—'}</td>
                      <td>
                        {partner.websiteUrl ? (
                          <a
                            href={partner.websiteUrl}
                            className="link link-primary"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Visit
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className="text-sm">
                          <div>{partner.email || '—'}</div>
                          <div className="text-xs text-base-content/60">
                            {partner.mobilePhone || '—'}
                          </div>
                        </div>
                      </td>
                      <td>{partner.displayOrder ?? '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-outline btn-info"
                            onClick={() => handleEdit(partner)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline btn-error"
                            onClick={() => handleDelete(partner)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showForm && (
          <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
              <h3 className="font-bold text-lg mb-4">
                {editingPartner ? 'Edit Partner' : 'Add New Partner'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Name *</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={formData.name}
                      onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Type *</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={formData.type}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          type: event.target.value as PartnerFormData['type'],
                        })
                      }
                      disabled={isSubmitting}
                    >
                      {partnerTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Status *</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={formData.status}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          status: event.target.value as PartnerFormData['status'],
                        })
                      }
                      disabled={isSubmitting}
                    >
                      {partnerStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Service Scope</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={formData.serviceScope}
                      onChange={(event) =>
                        setFormData({ ...formData, serviceScope: event.target.value })
                      }
                      disabled={!isPrinter || isSubmitting}
                    >
                      <option value="">Not set</option>
                      {partnerServiceScopeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {!isPrinter && (
                      <span className="text-xs text-base-content/60 mt-1">
                        Only available for printer partners.
                      </span>
                    )}
                  </div>

                  <div className="form-control sm:col-span-2">
                    <label className="label">
                      <span className="label-text">Logo URL *</span>
                    </label>
                    <input
                      type="url"
                      className="input input-bordered w-full"
                      value={formData.logoUrl}
                      onChange={(event) =>
                        setFormData({ ...formData, logoUrl: event.target.value })
                      }
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-control sm:col-span-2">
                    <label className="label">
                      <span className="label-text">Website URL</span>
                    </label>
                    <input
                      type="url"
                      className="input input-bordered w-full"
                      value={formData.websiteUrl}
                      onChange={(event) =>
                        setFormData({ ...formData, websiteUrl: event.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Email</span>
                    </label>
                    <input
                      type="email"
                      className="input input-bordered w-full"
                      value={formData.email}
                      onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Mobile Phone</span>
                    </label>
                    <input
                      type="tel"
                      className="input input-bordered w-full"
                      value={formData.mobilePhone}
                      onChange={(event) =>
                        setFormData({ ...formData, mobilePhone: event.target.value })
                      }
                      placeholder="+3519xxxxxxx"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Country</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={formData.countryCode}
                      onChange={(event) =>
                        setFormData({ ...formData, countryCode: event.target.value })
                      }
                      disabled={isSubmitting}
                    >
                      <option value="">Select country</option>
                      {formattedCountries.map((country) => (
                        <option key={country.value} value={country.value}>
                          {country.label} ({country.value})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">City</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={formData.city}
                      onChange={(event) => setFormData({ ...formData, city: event.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-control sm:col-span-2">
                    <label className="label">
                      <span className="label-text">Address Line 1</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={formData.addressLine1}
                      onChange={(event) =>
                        setFormData({ ...formData, addressLine1: event.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-control sm:col-span-2">
                    <label className="label">
                      <span className="label-text">Address Line 2</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={formData.addressLine2}
                      onChange={(event) =>
                        setFormData({ ...formData, addressLine2: event.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Postal Code</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={formData.postalCode}
                      onChange={(event) =>
                        setFormData({ ...formData, postalCode: event.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Display Order</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered w-full"
                      value={formData.displayOrder}
                      onChange={(event) =>
                        setFormData({ ...formData, displayOrder: event.target.value })
                      }
                      min={0}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-control sm:col-span-2">
                    <label className="label">
                      <span className="label-text">Short Description JSON *</span>
                    </label>
                    <textarea
                      className={`textarea textarea-bordered w-full font-mono ${
                        jsonError ? 'textarea-error' : ''
                      }`}
                      rows={6}
                      value={formData.shortDescription}
                      onChange={(event) =>
                        setFormData({ ...formData, shortDescription: event.target.value })
                      }
                      disabled={isSubmitting}
                    />
                    <span className="text-xs text-base-content/60 mt-1">
                      Provide a JSON object with locale keys and short descriptions.
                    </span>
                    {jsonError && <span className="text-xs text-error mt-1">{jsonError}</span>}
                  </div>
                </div>

                {error && (
                  <div className="alert alert-error">
                    <span>{error}</span>
                  </div>
                )}

                <div className="modal-action">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleCloseForm}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Saving...
                      </>
                    ) : editingPartner ? (
                      'Update Partner'
                    ) : (
                      'Create Partner'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
