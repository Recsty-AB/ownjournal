import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import i18n from '@/i18n/config';
import { saveFileNative } from '../nativeExport';
import { exportToPDF, type JournalEntry } from '../journalExport';

// Take the native branch: it is the one Android users get, and it hands the
// finished blob over instead of driving a browser download we cannot capture.
vi.mock('../nativeExport', () => ({
  isNativePlatform: () => true,
  saveFileNative: vi.fn(async (_blob: Blob, fileName: string) => ({
    path: fileName,
    uri: '',
    fileName,
  })),
}));

/** jsdom's Blob has no arrayBuffer(), so go through FileReader. */
const readBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () =>
      resolve(Uint8Array.from(reader.result as string, (char) => char.charCodeAt(0)));
    reader.readAsBinaryString(blob);
  });

/** The bytes jsPDF produced, decoded as WinAnsi — the encoding it writes. */
const capturedPdfText = async (): Promise<string> => {
  const call = vi.mocked(saveFileNative).mock.calls.at(-1);
  expect(call, 'exportToPDF never produced a file').toBeDefined();
  return new TextDecoder('windows-1252').decode(await readBytes(call![0] as Blob));
};

const ENTRY: JournalEntry = {
  id: '1',
  date: '2026-08-13T10:00:00Z',
  title: 'Ein guter Tag',
  body: 'Heute war schön.',
  mood: 'okay',
  tags: ['urlaub'],
  activities: [],
};

describe('exportToPDF', () => {
  beforeEach(async () => {
    vi.mocked(saveFileNative).mockClear();
    await i18n.changeLanguage('de');
  });

  it('writes dates in the reader\'s own locale, not a US pattern', async () => {
    await exportToPDF([ENTRY], 'Mein Tagebuch');
    const pdf = await capturedPdfText();

    expect(pdf).toContain('Donnerstag, 13. August 2026');
    expect(pdf).not.toContain('August 13');
  });

  it('drops emoji rather than printing them as mojibake', async () => {
    await exportToPDF(
      [{ ...ENTRY, title: 'Urlaub 🏖️', body: 'Sonne 😀 und Meer 🌊' }],
      'Mein Tagebuch 📔'
    );
    const pdf = await capturedPdfText();

    // The mood emoji sits between the label and the translated mood name.
    expect(pdf).toMatch(/Stimmung:\s?Okay/);
    expect(pdf).toContain('Urlaub');
    expect(pdf).toContain('Sonne und Meer');
    // Every emoji above is outside WinAnsi; nothing may survive re-encoded.
    for (const emoji of ['🏖', '😀', '🌊', '📔']) {
      expect(pdf).not.toContain(emoji);
    }
  });

  it('keeps the accented characters the font can encode', async () => {
    await exportToPDF([{ ...ENTRY, body: 'Größe, Straße, Grüße — 100 €' }], 'Tagebuch');
    const pdf = await capturedPdfText();

    expect(pdf).toContain('Größe, Straße, Grüße');
  });
});

describe('exportToPDF font embedding', () => {
  /** Serves the bundled faces from disk so the real TTF parsing runs. */
  const fontFetch = vi.fn(async (url: string) => {
    const name = url.split('/').pop()!.split('?')[0];
    const onDisk = name.startsWith('Noto') && name.endsWith('.ttf')
      ? name
      : 'NotoSans-Regular.ttf'; // the remote CJK subset stands in as bytes
    const file = readFileSync(resolve(__dirname, '../../assets/fonts', onDisk));
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    };
  });

  const requestedFonts = () => fontFetch.mock.calls.map(([url]) => String(url));

  beforeEach(() => {
    vi.mocked(saveFileNative).mockClear();
    fontFetch.mockClear();
    vi.stubGlobal('fetch', fontFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('embeds nothing when the built-in fonts can render the document', async () => {
    await i18n.changeLanguage('de');
    await exportToPDF([{ ...ENTRY, body: 'Größe, Straße — 100 € … †' }], 'Mein Tagebuch');

    expect(requestedFonts()).toEqual([]);
    expect(await capturedPdfText()).not.toContain('NotoSans');
  });

  it.each([
    ['Polish', 'Zażółć gęślą jaźń'],
    ['Vietnamese', 'Tiếng Việt rất đẹp'],
    ['Cyrillic', 'Привет, мир'],
    ['Greek', 'Καλημέρα κόσμε'],
  ])('embeds Noto Sans for %s content the built-in fonts cannot encode', async (_name, body) => {
    await i18n.changeLanguage('en');
    await exportToPDF([{ ...ENTRY, body }], 'Journal');

    expect(requestedFonts()).toHaveLength(1);
    expect(requestedFonts()[0]).toContain('NotoSans-Regular');
    expect(await capturedPdfText()).toContain('NotoSans');
  });

  it('embeds the Devanagari face for a Hindi journal', async () => {
    await i18n.changeLanguage('hi');
    await exportToPDF([{ ...ENTRY, title: 'नमस्ते', body: 'दुनिया' }], 'पत्रिका');

    expect(requestedFonts()[0]).toContain('NotoSansDevanagari');
  });

  it('embeds the Thai face for a Thai journal', async () => {
    await i18n.changeLanguage('th');
    await exportToPDF([{ ...ENTRY, title: 'สวัสดี', body: 'ชาวโลก' }], 'ไดอารี่');

    expect(requestedFonts()[0]).toContain('NotoSansThai');
  });

  it('still reaches for the remote subset on CJK, which is too large to bundle', async () => {
    await i18n.changeLanguage('ja');
    await exportToPDF([{ ...ENTRY, title: '日記', body: 'こんにちは' }], '私の日記');

    expect(requestedFonts()[0]).toContain('fonts.gstatic.com');
  });

  it('exports anyway when the font cannot be fetched', async () => {
    await i18n.changeLanguage('en');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));

    await expect(
      exportToPDF([{ ...ENTRY, body: 'Zażółć gęślą jaźń' }], 'Journal')
    ).resolves.toMatchObject({ fileName: expect.stringContaining('.pdf') });
  });
});
