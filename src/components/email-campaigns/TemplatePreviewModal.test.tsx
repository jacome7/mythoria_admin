import { render, screen } from '@testing-library/react';
import TemplatePreviewModal from './TemplatePreviewModal';

it('renders built-in helpers and escapes variables in the email preview', () => {
  render(
    <TemplatePreviewModal
      open
      onClose={() => {}}
      subject="Hello {{name}}"
      htmlBody="{{#if name}}<p>{{name}}</p>{{/if}}"
      locale="en-US"
      variablesJson={JSON.stringify({ name: '<reader>' })}
    />,
  );

  expect(screen.getByText('Hello &lt;reader&gt;')).toBeInTheDocument();
  expect(screen.getByTitle('Email template preview')).toHaveAttribute(
    'srcdoc',
    '<p>&lt;reader&gt;</p>',
  );
});
