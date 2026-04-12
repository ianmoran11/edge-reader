import { createElement } from 'react';
import type { Book } from '../types';

interface LibraryProps {
  books: Book[];
  onBookClick: (bookId: string) => void;
  onAddBook: () => void;
  onDeleteBook: (bookId: string) => void;
}

export function Library({
  books,
  onBookClick,
  onAddBook,
  onDeleteBook,
}: LibraryProps) {
  return createElement(
    'div',
    { className: 'library-view' },
    createElement(
      'header',
      { className: 'library-header' },
      createElement('h1', null, 'Library')
    ),
    books.length === 0
      ? createElement(
          'div',
          { className: 'empty-state' },
          createElement('p', null, 'No books yet'),
          createElement(
            'p',
            { className: 'empty-hint' },
            'Tap + to add your first book'
          )
        )
      : createElement(
          'div',
          { className: 'book-grid' },
          books.map((book) =>
            createElement(
              'div',
              {
                key: book.id,
                className: 'book-card',
                onClick: () => onBookClick(book.id),
              },
              book.coverBlob
                ? createElement('img', {
                    src: URL.createObjectURL(book.coverBlob),
                    alt: book.title,
                    className: 'book-cover',
                  })
                : createElement(
                    'div',
                    { className: 'book-cover-placeholder' },
                    createElement('span', null, '📖')
                  ),
              createElement(
                'div',
                { className: 'book-info' },
                createElement('h3', { className: 'book-title' }, book.title),
                createElement('p', { className: 'book-author' }, book.author)
              ),
              createElement(
                'button',
                {
                  className: 'delete-btn',
                  onClick: (e: Event) => {
                    e.stopPropagation();
                    onDeleteBook(book.id);
                  },
                },
                '×'
              )
            )
          )
        ),
    createElement(
      'button',
      {
        className: 'fab',
        onClick: onAddBook,
        'aria-label': 'Add book',
      },
      '+'
    ),
    createElement('input', {
      type: 'file',
      accept: '.epub',
      className: 'hidden-input',
      id: 'epub-input',
    })
  );
}
