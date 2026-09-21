import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '@/api/error-message';
import { listMembers, membersKeys } from '@/api/members';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PAGE_SIZE = 25;

export function MembersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDeferredValue(search.trim());

  const params = { page, page_size: PAGE_SIZE, q: q || undefined };
  const { data, error, isPending, isPlaceholderData } = useQuery({
    queryKey: membersKeys.list(params),
    queryFn: ({ signal }) => listMembers(params, signal),
    placeholderData: keepPreviousData,
  });

  const total = data?.meta.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">{t('members.title')}</h1>
          {data && (
            <p className="text-sm text-muted-foreground">{t('members.total', { count: total })}</p>
          )}
        </div>
        <Input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={t('members.searchPlaceholder')}
          aria-label={t('common.search')}
          className="w-full sm:max-w-xs"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage(error, t)}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('members.name')}</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">{t('members.email')}</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">{t('members.phone')}</th>
              <th className="px-4 py-3 font-medium">{t('members.status.label')}</th>
            </tr>
          </thead>
          <tbody className={isPlaceholderData ? 'opacity-60' : undefined}>
            {isPending && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {data?.data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  {t('members.empty')}
                </td>
              </tr>
            )}
            {data?.data.map((member) => (
              <tr key={member.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">
                  {member.last_name}, {member.first_name}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  {member.email ?? t('common.notAvailable')}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  {member.phone ?? t('common.notAvailable')}
                </td>
                <td className="px-4 py-3">{t(`members.status.${member.status}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          {t('common.previous')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {page} / {lastPage}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= lastPage}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}
