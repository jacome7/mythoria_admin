import { fireEvent, render, screen } from '@testing-library/react';
import AdminPremiumEditionReader from '@/components/AdminPremiumEditionReader';

it('shows selectable publication details and can preview the pinned image separately', () => {
  const storyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const revision = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  render(
    <AdminPremiumEditionReader
      storyId={storyId}
      book={{
        revision,
        locale: 'pt-PT',
        title: 'O Jardim',
        editionLayout: 'embedded-lettering-v2',
        specification: {
          title: { label: 'Título', value: 'O Jardim' },
          details: [{ label: 'Autor', value: 'Autora Exemplo' }],
          copyright: '© Mythoria',
          rights: 'Direitos reservados',
          promotion: 'Crie o seu próximo livro',
        },
        pages: [
          { number: 1, kind: 'title', text: 'O Jardim' },
          {
            number: 2,
            kind: 'copyright',
            text: 'Título O Jardim, Autor Autora Exemplo',
            image: '/verified/2',
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole('img')).toHaveAttribute(
    'src',
    `/api/admin/stories/${storyId}/premium-edition/front?revision=${revision}`,
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Book page' }), { target: { value: '2' } });
  expect(screen.getByText('Autora Exemplo')).toBeVisible();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Preview Page Artwork' }));
  expect(screen.getByRole('img')).toHaveAttribute(
    'src',
    `/api/admin/stories/${storyId}/premium-edition/2?revision=${revision}`,
  );
  expect(screen.getByText('Page transcript')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Show Text' }));
  expect(screen.getByText('Direitos reservados')).toBeVisible();
});

it('renders typeset copy once as selectable text even when a reading image is supplied', () => {
  const text = 'Primeiro parágrafo.\n\nSegundo parágrafo.';
  render(
    <AdminPremiumEditionReader
      storyId="story"
      book={{
        revision: 'revision',
        locale: 'pt-PT',
        title: 'O Jardim',
        audience: 'children_0-2',
        openingDesign: { background: '#f9efd9' },
        pages: [{ number: 6, kind: 'spread', text, renderMode: 'typeset', image: '/reading/6' }],
      }}
    />,
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Book page' }), { target: { value: '1' } });
  const paragraph = screen.getByText('Primeiro parágrafo. Segundo parágrafo.');
  expect(paragraph.textContent).toBe(text);
  expect(paragraph).toHaveStyle({ fontFamily: 'PremiumLiterata, serif' });
  expect(paragraph.style.lineHeight).toBe('1.4');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.queryByText('Page transcript')).not.toBeInTheDocument();
});
