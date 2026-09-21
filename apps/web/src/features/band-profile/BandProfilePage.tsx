import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { bandProfileKey, getBandProfile } from '@/api/band-profile';
import { errorMessage } from '@/api/error-message';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function BandProfilePage() {
  const { t } = useTranslation();
  const { data, error, isPending } = useQuery({
    queryKey: bandProfileKey,
    queryFn: ({ signal }) => getBandProfile(signal),
  });

  const dash = t('common.notAvailable');
  const rows: [string, string | null | undefined][] = [
    [t('bandProfile.name'), data?.name],
    [t('bandProfile.legalName'), data?.legal_name],
    [t('bandProfile.taxId'), data?.tax_id],
    [t('bandProfile.email'), data?.email],
    [t('bandProfile.phone'), data?.phone],
    [t('bandProfile.website'), data?.website],
    [t('bandProfile.address'), data?.address_line],
    [t('bandProfile.city'), data?.city],
    [t('bandProfile.postalCode'), data?.postal_code],
    [t('bandProfile.country'), data?.country],
    [t('bandProfile.currency'), data?.default_currency],
    [t('bandProfile.timezone'), data?.timezone],
    [t('bandProfile.foundedOn'), data?.founded_on],
  ];

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-2xl font-semibold">{t('bandProfile.title')}</h1>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage(error, t)}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{data?.name ?? (isPending ? t('common.loading') : dash)}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value || dash}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
