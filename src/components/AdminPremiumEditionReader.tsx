'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export interface AdminPremiumEdition {
  revision: string;
  title: string;
  locale: string;
  editionLayout?: string;
  specification?: {
    title: { label: string; value: string };
    details: { label: string; value: string }[];
    copyright: string;
    rights: string;
    promotion: string;
  };
  pages: {
    number: number;
    kind: string;
    text: string;
    image?: string;
    imageDescription?: string;
    textBox?: { x: number; y: number; width: number; height: number };
  }[];
}

export default function AdminPremiumEditionReader({
  storyId,
  book,
}: {
  storyId: string;
  book: AdminPremiumEdition;
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string>();
  const [previewPage, setPreviewPage] = useState<number>();
  const lastIndex = book.pages.length + 1;
  const page = book.pages[index - 1];
  const image =
    index === 0
      ? 'front'
      : index === lastIndex
        ? 'back'
        : page?.image
          ? String(page.number)
          : undefined;
  const title =
    index === 0 ? 'Front Cover' : index === lastIndex ? 'Back Cover' : `Page ${page.number}`;
  const isTextPage = page && [1, 2, 3, 4, 33].includes(page.number);
  const showImage = image && (!isTextPage || previewPage === page.number);
  const visibleImage = showImage && failed !== image;
  const embedded = book.editionLayout === 'embedded-lettering-v2';
  const overlay = !embedded && visibleImage && page?.textBox;
  const description = [page?.imageDescription, embedded ? page?.text : undefined]
    .filter(Boolean)
    .join(' ');
  const specification = page?.kind === 'copyright' && book.specification;

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <Link href={`/stories/${storyId}`} className="link">
        Back to Story Details
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold" lang={book.locale}>
          {book.title}
        </h1>
        <p className="text-sm break-all">Edition {book.revision}</p>
      </header>
      <nav className="flex flex-wrap items-center gap-2" aria-label="Book pages">
        <button className="btn btn-sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Previous
        </button>
        <label className="sr-only" htmlFor="premium-book-page">
          Book page
        </label>
        <select
          id="premium-book-page"
          className="select select-bordered select-sm"
          value={index}
          onChange={(event) => setIndex(Number(event.target.value))}
        >
          <option value={0}>Front Cover</option>
          {book.pages.map(({ number, kind }, offset) => (
            <option key={number} value={offset + 1}>
              Page {number} · {kind}
            </option>
          ))}
          <option value={lastIndex}>Back Cover</option>
        </select>
        <button
          className="btn btn-sm"
          disabled={index === lastIndex}
          onClick={() => setIndex(index + 1)}
        >
          Next
        </button>
      </nav>
      <article className="mx-auto w-full max-w-[680px]" aria-label={title} lang={book.locale}>
        {isTextPage && image && (
          <button
            type="button"
            className="btn btn-sm mb-3"
            aria-pressed={Boolean(showImage)}
            onClick={() => setPreviewPage(showImage ? undefined : page.number)}
          >
            {showImage ? 'Show Text' : 'Preview Page Artwork'}
          </button>
        )}
        <div className="relative aspect-square overflow-hidden rounded-lg bg-white text-black shadow-sm">
          {visibleImage && (
            <Image
              key={image}
              src={`/api/admin/stories/${storyId}/premium-edition/${image}?revision=${book.revision}`}
              alt={description || (page ? '' : `${book.title} · ${title}`)}
              fill
              unoptimized
              sizes="(min-width: 720px) 680px, calc(100vw - 2rem)"
              className="object-contain"
              onError={() => setFailed(image)}
            />
          )}
          {showImage && !visibleImage && (
            <p className="p-4 text-sm" role="alert">
              Page artwork is unavailable. Reload the reader to check the current edition.
            </p>
          )}
          {page?.text &&
            (overlay ? (
              <div
                className="absolute grid place-items-center overflow-auto whitespace-pre-wrap text-center text-[clamp(0.75rem,2.5vw,1.25rem)]"
                style={{
                  left: `${overlay.x * 100}%`,
                  top: `${overlay.y * 100}%`,
                  width: `${overlay.width * 100}%`,
                  height: `${overlay.height * 100}%`,
                }}
              >
                {page.text}
              </div>
            ) : (
              !visibleImage && (
                <div className="h-full overflow-auto whitespace-pre-wrap px-[10%] py-[12%] text-[clamp(0.9rem,3vw,1.4rem)]">
                  {specification ? (
                    <>
                      <dl className="space-y-1">
                        {[specification.title, ...specification.details].map(({ label, value }) => (
                          <div key={label}>
                            <dt className="inline font-semibold">{label} </dt>
                            <dd className="inline">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      {[specification.copyright, specification.rights, specification.promotion].map(
                        (line) => (
                          <p key={line} className="mt-3">
                            {line}
                          </p>
                        ),
                      )}
                    </>
                  ) : (
                    page.text
                  )}
                </div>
              )
            ))}
        </div>
        {page?.text && visibleImage && !overlay && (
          <details className="mt-3 rounded-md border border-base-300 p-3">
            <summary className="cursor-pointer">Page transcript</summary>
            <p className="mt-2 whitespace-pre-wrap">{page.text}</p>
          </details>
        )}
      </article>
    </main>
  );
}
