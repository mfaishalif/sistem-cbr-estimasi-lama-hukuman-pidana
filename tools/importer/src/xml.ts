import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const SECTION_TAGS = [
  'kepala_putusan',
  'identitas',
  'riwayat_penahanan',
  'riwayat_perkara',
  'riwayat_tuntutan',
  'riwayat_dakwaan',
  'fakta',
  'fakta_hukum',
  'pertimbangan_hukum',
  'amar_putusan',
  'penutup',
] as const;

export type SectionTag = (typeof SECTION_TAGS)[number];

export interface IndoLawDocument {
  xmlId: string;
  url: string | null;
  classification: string;
  subClassification: string;
  courtSlug: string;
  province: string;
  status: string;
  amar: string;
  amarOther: string;
  metadataSentenceDays: number | null;
  metadataSentenceRaw: string | null;
  sections: Partial<Record<SectionTag, string>>;
}

export class XmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XmlParseError';
  }
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function collectText(node: unknown): string {
  if (typeof node === 'string') {
    return node;
  }
  if (typeof node === 'number' || typeof node === 'boolean') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(collectText).filter((part) => part.length > 0).join('\n');
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>)
      .filter(([key]) => !key.startsWith('@_'))
      .map(([, value]) => collectText(value))
      .filter((part) => part.length > 0)
      .join('\n');
  }
  return '';
}

function rootAttribute(root: Record<string, unknown>, key: string): string {
  const value = root[`@_${key}`];
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '';
}

function optionalAttribute(root: Record<string, unknown>, key: string): string | null {
  const value = rootAttribute(root, key);
  return value.length === 0 ? null : value;
}

function parseMetadataDays(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Parse one pinned Indo-Law XML document. The parser intentionally keeps text
 * as text: numeric-looking values in a section are case facts, not metadata.
 */
export function parseIndoLawXml(xml: string): IndoLawDocument {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new XmlParseError(
      typeof validation === 'object' ? validation.err.msg : 'invalid XML document',
    );
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    trimValues: true,
    processEntities: true,
  });

  const parsed = parser.parse(xml) as Record<string, unknown>;
  const rootValue = parsed.putusan;
  if (rootValue === null || rootValue === undefined || typeof rootValue !== 'object') {
    throw new XmlParseError('root element putusan is missing');
  }

  const root = rootValue as Record<string, unknown>;
  const sections: Partial<Record<SectionTag, string>> = {};

  for (const tag of SECTION_TAGS) {
    const node = root[tag];
    if (node === undefined) {
      continue;
    }
    const text = collapseWhitespace(collectText(node));
    if (text.length > 0) {
      sections[tag] = text;
    }
  }

  const candidateId = optionalAttribute(root, 'id');

  return {
    xmlId: candidateId ?? '',
    url: optionalAttribute(root, 'url'),
    classification: rootAttribute(root, 'klasifikasi'),
    subClassification: rootAttribute(root, 'sub_klasifikasi'),
    courtSlug: rootAttribute(root, 'lembaga_peradilan'),
    province: rootAttribute(root, 'provinsi'),
    status: rootAttribute(root, 'status'),
    amar: rootAttribute(root, 'amar'),
    amarOther: rootAttribute(root, 'amar_lainnya'),
    metadataSentenceRaw: optionalAttribute(root, 'lama_hukuman'),
    metadataSentenceDays: parseMetadataDays(optionalAttribute(root, 'lama_hukuman')),
    sections,
  };
}
