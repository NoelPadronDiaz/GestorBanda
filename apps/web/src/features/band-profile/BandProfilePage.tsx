import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  bandProfileKey,
  getBandProfile,
  updateBandProfile,
  type BandProfileInput,
} from '@/api/band-profile';
import { errorMessage } from '@/api/error-message';
import type { BandProfile } from '@/api/types';
import { useAction } from '@/api/use-action';
import { FormField, FormGrid } from '@/components/form-field';
import { ErrorNotice, Notice, Page, PageHeader, Panel } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/use-auth';
import { nullable } from '@/lib/forms';

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(200),
  legal_name: z.string().max(200),
  tax_id: z.string().max(32),
  email: z.union([z.literal(''), z.email('validation.email')]),
  phone: z.string().max(32),
  website: z.string().max(255),
  address_line: z.string().max(255),
  city: z.string().max(120),
  postal_code: z.string().max(16),
  founded_on: z.string(),
  iban: z
    .string()
    .transform((v) => v.replace(/\s+/g, '').toUpperCase())
    .refine((v) => v === '' || /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(v), 'bandProfile.ibanInvalid'),
  invoice_footer: z.string().max(1000),
});
type Values = z.input<typeof schema>;
type Parsed = z.output<typeof schema>;

/** IBAN agrupado de 4 en 4 para leerlo (se guarda sin espacios). */
const groupIban = (iban: string | null) => (iban ?? '').replace(/(.{4})/g, '$1 ').trim();

export function BandProfilePage() {
  const { t } = useTranslation();
  const { data, error } = useQuery({
    queryKey: bandProfileKey,
    queryFn: ({ signal }) => getBandProfile(signal),
  });
  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.association')}
        title={t('bandProfile.title')}
        description={t('bandProfile.subtitle')}
      />
      {error && <ErrorNotice message={errorMessage(error, t)} />}
      {data && <ProfileForm key={data.updated_at} profile={data} />}
    </Page>
  );
}

function ProfileForm({ profile }: { profile: BandProfile }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const editable = can('band_profile.update');
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: profile.name,
      legal_name: profile.legal_name ?? '',
      tax_id: profile.tax_id ?? '',
      email: profile.email ?? '',
      phone: profile.phone ?? '',
      website: profile.website ?? '',
      address_line: profile.address_line ?? '',
      city: profile.city ?? '',
      postal_code: profile.postal_code ?? '',
      founded_on: profile.founded_on ?? '',
      iban: groupIban(profile.iban),
      invoice_footer: profile.invoice_footer ?? '',
    },
  });
  const save = useAction((body: BandProfileInput) => updateBandProfile(body), {
    invalidate: [bandProfileKey],
    success: 'bandProfile.saved',
  });
  const onSubmit = handleSubmit((v) =>
    save.mutate({
      name: v.name.trim(),
      legal_name: nullable(v.legal_name),
      tax_id: nullable(v.tax_id)?.toUpperCase() ?? null,
      email: nullable(v.email),
      phone: nullable(v.phone),
      website: nullable(v.website),
      address_line: nullable(v.address_line),
      city: nullable(v.city),
      postal_code: nullable(v.postal_code),
      founded_on: v.founded_on || null,
      iban: v.iban || null,
      invoice_footer: nullable(v.invoice_footer),
    }),
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {!profile.tax_id && <Notice tone="warning">{t('invoices.missingTaxId')}</Notice>}
      <fieldset disabled={!editable} className="grid gap-5">
        <Panel title={t('bandProfile.identity')}>
          <FormGrid cols={3}>
            <FormField id="bp_name" label={t('bandProfile.name')} error={errors.name?.message}>
              <Input id="bp_name" {...register('name')} />
            </FormField>
            <FormField
              id="bp_legal"
              label={t('bandProfile.legalName')}
              hint={t('bandProfile.legalNameHint')}
            >
              <Input id="bp_legal" {...register('legal_name')} />
            </FormField>
            <FormField id="bp_tax" label={t('bandProfile.taxId')}>
              <Input id="bp_tax" {...register('tax_id')} />
            </FormField>
            <FormField id="bp_founded" label={t('bandProfile.foundedOn')}>
              <Input id="bp_founded" type="date" {...register('founded_on')} />
            </FormField>
            <FormField id="bp_web" label={t('bandProfile.website')}>
              <Input id="bp_web" {...register('website')} />
            </FormField>
          </FormGrid>
        </Panel>
        <Panel title={t('bandProfile.contact')}>
          <FormGrid cols={3}>
            <FormField id="bp_email" label={t('bandProfile.email')} error={errors.email?.message}>
              <Input id="bp_email" type="email" {...register('email')} />
            </FormField>
            <FormField id="bp_phone" label={t('bandProfile.phone')}>
              <Input id="bp_phone" {...register('phone')} />
            </FormField>
            <FormField id="bp_address" label={t('bandProfile.address')}>
              <Input id="bp_address" {...register('address_line')} />
            </FormField>
            <FormField id="bp_postal" label={t('bandProfile.postalCode')}>
              <Input id="bp_postal" {...register('postal_code')} />
            </FormField>
            <FormField id="bp_city" label={t('bandProfile.city')}>
              <Input id="bp_city" {...register('city')} />
            </FormField>
          </FormGrid>
        </Panel>
        <Panel title={t('bandProfile.invoicing')}>
          <FormGrid>
            <FormField
              id="bp_iban"
              label="IBAN"
              error={errors.iban?.message}
              hint={t('bandProfile.ibanHint')}
            >
              <Input id="bp_iban" autoComplete="off" {...register('iban')} />
            </FormField>
            <FormField
              id="bp_footer"
              label={t('bandProfile.invoiceFooter')}
              hint={t('bandProfile.invoiceFooterHint')}
            >
              <Textarea id="bp_footer" rows={4} {...register('invoice_footer')} />
            </FormField>
          </FormGrid>
        </Panel>
      </fieldset>
      {editable && (
        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      )}
    </form>
  );
}
