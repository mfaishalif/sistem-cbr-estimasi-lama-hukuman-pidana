import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FieldHint, Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ArticleRowState, CaseFormState } from '@/lib/case-form';
import { newArticleRow } from '@/lib/case-form';

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

function Field({ id, label, hint, children, className }: FieldProps) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {hint === undefined ? null : <FieldHint className="mt-1.5">{hint}</FieldHint>}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-hairline pt-6 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
      {description === undefined ? null : (
        <p className="mt-1 text-xs leading-relaxed text-ink-subtle">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

interface CaseFormProps {
  idPrefix: string;
  value: CaseFormState;
  onChange: (value: CaseFormState) => void;
  disabled?: boolean;
}

export function CaseForm({ idPrefix, value, onChange, disabled = false }: CaseFormProps) {
  const patch = (changes: Partial<CaseFormState>) => onChange({ ...value, ...changes });

  const patchArticle = (index: number, changes: Partial<ArticleRowState>) => {
    const articles = value.articles.map((row, position) =>
      position === index ? { ...row, ...changes } : row,
    );
    patch({ articles });
  };

  return (
    <div className="space-y-7">
      <Section
        title="Identitas perkara"
        description="Dipisahkan dari fakta. Pengadilan dan nomor perkara diperlukan saat menyimpan (Retain) atau mengelola kasus."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idPrefix}-court`} label="Pengadilan">
            <Input
              id={`${idPrefix}-court`}
              value={value.court}
              onChange={(event) => patch({ court: event.target.value })}
              placeholder="PN Contoh"
              disabled={disabled}
            />
          </Field>
          <Field id={`${idPrefix}-case-number`} label="Nomor perkara">
            <Input
              id={`${idPrefix}-case-number`}
              value={value.caseNumber}
              onChange={(event) => patch({ caseNumber: event.target.value })}
              placeholder="1/Pid.B/2024/PN Contoh"
              disabled={disabled}
            />
          </Field>
          <Field
            id={`${idPrefix}-defendant`}
            label="Nama terdakwa (opsional)"
            hint="Hanya untuk ketertelusuran; nama tidak dipakai sebagai fitur kemiripan."
          >
            <Input
              id={`${idPrefix}-defendant`}
              value={value.defendantName}
              onChange={(event) => patch({ defendantName: event.target.value })}
              disabled={disabled}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Fakta pra-putusan"
        description="Hanya informasi yang sudah diketahui sebelum putusan. Jangan memasukkan amar, pasal yang terbukti, atau pertimbangan hakim."
      >
        <div className="space-y-4">
          <Field
            id={`${idPrefix}-narration`}
            label="Narasi fakta perkara (wajib)"
            hint="Uraikan kejadian dan keterlibatan terdakwa. Narasi yang tidak memuat istilah yang dikenali membuat estimasi ditahan."
          >
            <Textarea
              id={`${idPrefix}-narration`}
              value={value.narration}
              onChange={(event) => patch({ narration: event.target.value })}
              rows={6}
              disabled={disabled}
            />
          </Field>
          <Field
            id={`${idPrefix}-category`}
            label="Kategori perbuatan (opsional)"
            hint="Isi hanya bila aman ditentukan dari informasi pra-putusan. Bila diisi, pencarian dibatasi ke kategori yang sama."
          >
            <Input
              id={`${idPrefix}-category`}
              value={value.category}
              onChange={(event) => patch({ category: event.target.value })}
              placeholder="mis. pencurian"
              disabled={disabled}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Pasal dakwaan (opsional)"
        description="Pasal yang didakwakan, bukan pasal yang akhirnya terbukti. Susunan alternatif/subsidair tetap disimpan."
      >
        <div className="space-y-3">
          {value.articles.length === 0 ? (
            <p className="text-sm text-ink-subtle">Belum ada pasal dakwaan.</p>
          ) : (
            value.articles.map((article, index) => (
              <div
                key={article.key}
                className="grid gap-3 rounded-lg border border-hairline bg-surface-2 p-3 sm:grid-cols-[1fr_0.7fr_0.7fr_0.9fr_auto] sm:items-end"
              >
                <Field id={`${idPrefix}-article-law-${index}`} label="Undang-undang">
                  <Input
                    id={`${idPrefix}-article-law-${index}`}
                    value={article.law}
                    onChange={(event) => patchArticle(index, { law: event.target.value })}
                    placeholder="KUHP"
                    disabled={disabled}
                  />
                </Field>
                <Field id={`${idPrefix}-article-number-${index}`} label="Pasal">
                  <Input
                    id={`${idPrefix}-article-number-${index}`}
                    value={article.article}
                    onChange={(event) => patchArticle(index, { article: event.target.value })}
                    placeholder="362"
                    disabled={disabled}
                  />
                </Field>
                <Field id={`${idPrefix}-article-paragraph-${index}`} label="Ayat">
                  <Input
                    id={`${idPrefix}-article-paragraph-${index}`}
                    value={article.paragraph}
                    onChange={(event) =>
                      patchArticle(index, { paragraph: event.target.value })
                    }
                    disabled={disabled}
                  />
                </Field>
                <Field id={`${idPrefix}-article-arrangement-${index}`} label="Susunan">
                  <Select
                    id={`${idPrefix}-article-arrangement-${index}`}
                    value={article.arrangement}
                    onChange={(event) =>
                      patchArticle(index, {
                        arrangement: event.target.value as ArticleRowState['arrangement'],
                      })
                    }
                    disabled={disabled}
                  >
                    <option value="primary">Utama</option>
                    <option value="alternative">Alternatif</option>
                    <option value="subsidiary">Subsidair</option>
                  </Select>
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Hapus pasal ${index + 1}`}
                  onClick={() =>
                    patch({ articles: value.articles.filter((_, position) => position !== index) })
                  }
                  disabled={disabled}
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => patch({ articles: [...value.articles, newArticleRow()] })}
            disabled={disabled}
          >
            <Plus />
            Tambah pasal
          </Button>
        </div>
      </Section>

      <Section
        title="Atribut fakta (opsional)"
        description="Kosongkan yang tidak diketahui. Nilai kosong tidak dianggap nol, 'tidak ada', atau kecocokan sempurna."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id={`${idPrefix}-age`} label="Umur (tahun)">
            <Input
              id={`${idPrefix}-age`}
              type="number"
              min={0}
              inputMode="numeric"
              value={value.ageYears}
              onChange={(event) => patch({ ageYears: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field
            id={`${idPrefix}-age-date`}
            label="Acuan waktu umur"
            hint="Umur hanya dibandingkan bila acuan waktu juga diketahui."
          >
            <Input
              id={`${idPrefix}-age-date`}
              type="date"
              value={value.ageReferenceDate}
              onChange={(event) => patch({ ageReferenceDate: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field id={`${idPrefix}-gender`} label="Jenis kelamin">
            <Input
              id={`${idPrefix}-gender`}
              value={value.gender}
              onChange={(event) => patch({ gender: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field id={`${idPrefix}-occupation`} label="Pekerjaan">
            <Input
              id={`${idPrefix}-occupation`}
              value={value.occupation}
              onChange={(event) => patch({ occupation: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field id={`${idPrefix}-education`} label="Pendidikan">
            <Input
              id={`${idPrefix}-education`}
              value={value.education}
              onChange={(event) => patch({ education: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field id={`${idPrefix}-role`} label="Peran">
            <Input
              id={`${idPrefix}-role`}
              value={value.role}
              onChange={(event) => patch({ role: event.target.value })}
              placeholder="mis. pelaku utama"
              disabled={disabled}
            />
          </Field>
          <Field id={`${idPrefix}-victim-count`} label="Jumlah korban">
            <Input
              id={`${idPrefix}-victim-count`}
              type="number"
              min={0}
              inputMode="numeric"
              value={value.victimCount}
              onChange={(event) => patch({ victimCount: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field
            id={`${idPrefix}-victim-harm`}
            label="Akibat pada korban"
            hint="Pisahkan beberapa nilai dengan koma."
          >
            <Input
              id={`${idPrefix}-victim-harm`}
              value={value.victimHarm}
              onChange={(event) => patch({ victimHarm: event.target.value })}
              placeholder="luka ringan, kerugian harta"
              disabled={disabled}
            />
          </Field>
          <Field id={`${idPrefix}-loss`} label="Kerugian (IDR)">
            <Input
              id={`${idPrefix}-loss`}
              type="number"
              min={0}
              inputMode="numeric"
              value={value.lossAmountIdr}
              onChange={(event) => patch({ lossAmountIdr: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field
            id={`${idPrefix}-mode`}
            label="Barang / cara / senjata"
            hint="Pisahkan beberapa nilai dengan koma."
          >
            <Input
              id={`${idPrefix}-mode`}
              value={value.weaponOrMode}
              onChange={(event) => patch({ weaponOrMode: event.target.value })}
              placeholder="kunci, malam hari"
              disabled={disabled}
            />
          </Field>
          <Field id={`${idPrefix}-prior`} label="Riwayat penghukuman">
            <Select
              id={`${idPrefix}-prior`}
              value={value.priorConviction}
              onChange={(event) =>
                patch({ priorConviction: event.target.value as CaseFormState['priorConviction'] })
              }
              disabled={disabled}
            >
              <option value="">Tidak diketahui</option>
              <option value="no">Belum pernah dihukum</option>
              <option value="yes">Pernah dihukum</option>
            </Select>
          </Field>
        </div>
      </Section>
    </div>
  );
}
