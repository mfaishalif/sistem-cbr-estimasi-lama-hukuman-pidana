/**
 * Shared layout for perkara forms (Estimasi, simpan putusan, Basis kasus).
 *
 * Every field sits on one 12-column grid with a 16px column gap. Forms are
 * `@container`s, so spans follow the form's own width, not the viewport: the
 * Estimasi column on desktop is only ~427px wide, while the Basis kasus sheet
 * is ~704px. `@2xl:` (42rem = 672px) is the first width where the one-row
 * article layout (UU 3 | Pasal 2 | Ayat 2 | Susunan 4 | hapus 1) fits a
 * 40px delete button.
 *
 * Vertical rhythm: 20px between fields, 16px from a section heading to its
 * first field, 40px between sections.
 */
export const FORM_CONTAINER = '@container w-full max-w-[720px]';
export const FORM_GRID = 'grid grid-cols-12 gap-x-4 gap-y-5';
export const SECTION_HEADING = 'text-[15px] font-semibold text-ink';
export const SECTION_BODY = 'mt-4';
export const SECTION_GAP = 'space-y-10';

/** Column spans: narrow container first, then the spec widths from 672px. */
export const span = {
  full: 'col-span-12',
  half: 'col-span-12 @md:col-span-6',
  law: 'col-span-4 @2xl:col-span-3',
  articleNumber: 'col-span-4 @2xl:col-span-2',
  paragraph: 'col-span-4 @2xl:col-span-2',
  arrangement: 'col-span-8 @2xl:col-span-4',
  remove: 'col-span-4 @2xl:col-span-1',
  age: 'col-span-4 @2xl:col-span-3',
  date: 'col-span-8 @2xl:col-span-4',
  select: 'col-span-12 @2xl:col-span-6',
  role: 'col-span-8 @2xl:col-span-6',
  // 5/7 on phones so the "Jumlah korban" label stays on one line; 4/8 from 448px.
  count: 'col-span-5 @md:col-span-4',
  money: 'col-span-7 @md:col-span-8',
} as const;
