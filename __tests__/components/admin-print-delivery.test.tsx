import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  AdminPrintDelivery,
  emptyAdminPrintDelivery,
  type AdminPrintDeliveryValue,
} from '@/components/AdminPrintDelivery';

function DeliveryForm() {
  const [value, setValue] = useState<AdminPrintDeliveryValue>(emptyAdminPrintDelivery);
  return <AdminPrintDelivery value={value} onChange={setValue} provider="lulu" />;
}

it('fills the saved staff destination and clears its details when the recipient changes', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      destinations: [
        {
          id: 'office',
          label: 'Lisbon office',
          address: {
            name: 'Print team',
            email: 'office@example.test',
            phone_number: '+351210000000',
            street1: 'Rua do Livro 4',
            city: 'Lisboa',
            postcode: '1000-001',
            country_code: 'PT',
          },
        },
      ],
    }),
  });
  try {
    render(<DeliveryForm />);
    const source = screen.getByLabelText('Delivery address source');
    fireEvent.change(source, { target: { value: 'staff_saved' } });
    await screen.findByRole('option', { name: 'Lisbon office' });
    fireEvent.change(screen.getByLabelText('My staff destinations'), {
      target: { value: 'office' },
    });
    expect(screen.getByLabelText('Country')).toHaveValue('PT');
    expect(screen.getByLabelText('Ship-to recipient')).toHaveValue('Print team');
    expect(screen.getByLabelText('Street address')).toHaveValue('Rua do Livro 4');
    expect(screen.queryByLabelText('Region')).toBeNull();
    expect(screen.queryByLabelText('Recipient tax ID')).toBeNull();
    fireEvent.change(source, { target: { value: 'someone_else' } });
    expect(screen.getByLabelText('Country')).toHaveValue('');
    expect(screen.queryByDisplayValue('Rua do Livro 4')).toBeNull();
  } finally {
    globalThis.fetch = originalFetch;
  }
});
