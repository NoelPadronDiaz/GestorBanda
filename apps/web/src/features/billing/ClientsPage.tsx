import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  billingKeys,
  createClient,
  deleteClient,
  listClients,
  updateClient,
  type Client,
  type ClientInput,
} from '@/api/billing';
import { useAction } from '@/api/use-action';
import { FormField, FormGrid } from '@/components/form-field';
import { FilterBar, FilterField, Page, PageHeader, Panel } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import { confirmAction } from '@/features/shared/confirm';
import { nullable } from '@/lib/forms';

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(160),
  tax_id: z.string().max(32),
  address_line: z.string().max(255),
  city: z.string().max(160),
  email: z.union([z.literal(''), z.email('validation.email')]),
  phone: z.string().max(40),
  notes: z.string().max(2000),
});
type Values = z.infer<typeof schema>;

export function ClientsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [editing, setEditing] = useState<Client | 'new' | null>(null);
  const { data, isPending } = useQuery({
    queryKey: billingKeys.clients(q),
    queryFn: ({ signal }) => listClients(q || undefined, signal),
  });
  const remove = useAction(deleteClient, {
    invalidate: [billingKeys.all],
    success: 'clients.deleted',
  });

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.billing')}
        title={t('clients.title')}
        description={t('clients.subtitle')}
        actions={
          can('billing.manage') && (
            <Button onClick={() => setEditing('new')}>
              <Plus /> {t('clients.new')}
            </Button>
          )
        }
      />
      <Panel flush>
        <div className="px-5 pt-5 pb-3">
          <FilterBar>
            <FilterField label={t('common.search')}>
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('clients.searchPlaceholder')}
                className="sm:w-72"
              />
            </FilterField>
          </FilterBar>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>{t('clients.name')}</Th>
              <Th>{t('common.taxId')}</Th>
              <Th>{t('common.city')}</Th>
              <Th>{t('common.contact')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {isPending && <EmptyRow colSpan={5}>{t('common.loading')}</EmptyRow>}
            {data?.data.length === 0 && <EmptyRow colSpan={5}>{t('clients.empty')}</EmptyRow>}
            {data?.data.map((client) => (
              <tr key={client.id}>
                <Td className="font-semibold">{client.name}</Td>
                <Td>{client.tax_id ?? '—'}</Td>
                <Td>{client.city ?? '—'}</Td>
                <Td className="text-xs text-muted-foreground">
                  {[client.email, client.phone].filter(Boolean).join(' · ') || '—'}
                </Td>
                <Td>
                  {can('billing.manage') && (
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="xs" onClick={() => setEditing(client)}>
                        <Pencil /> {t('common.edit')}
                      </Button>
                      <Button
                        variant="destructive-outline"
                        size="xs"
                        aria-label={t('common.delete')}
                        onClick={() =>
                          confirmAction(t('clients.confirmDelete', { name: client.name })) &&
                          remove.mutate(client.id)
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      {editing && (
        <ClientDialog
          client={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}

function ClientDialog({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: client?.name ?? '',
      tax_id: client?.tax_id ?? '',
      address_line: client?.address_line ?? '',
      city: client?.city ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      notes: client?.notes ?? '',
    },
  });
  const save = useAction(
    (body: ClientInput) => (client ? updateClient(client.id, body) : createClient(body)),
    {
      invalidate: [billingKeys.all],
      success: 'clients.saved',
      onSuccess: onClose,
    },
  );
  const onSubmit = handleSubmit((values) =>
    save.mutate({
      name: values.name.trim(),
      tax_id: nullable(values.tax_id),
      address_line: nullable(values.address_line),
      city: nullable(values.city),
      email: nullable(values.email),
      phone: nullable(values.phone),
      notes: nullable(values.notes),
    }),
  );

  return (
    <Dialog open onClose={onClose} title={client ? t('clients.edit') : t('clients.new')} size="lg">
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <FormGrid>
          <FormField id="name" label={t('clients.name')} error={errors.name?.message}>
            <Input id="name" autoFocus {...register('name')} />
          </FormField>
          <FormField id="tax_id" label={t('common.taxId')}>
            <Input id="tax_id" {...register('tax_id')} />
          </FormField>
          <FormField id="address_line" label={t('common.address')}>
            <Input id="address_line" {...register('address_line')} />
          </FormField>
          <FormField id="city" label={t('common.cityFull')}>
            <Input id="city" {...register('city')} />
          </FormField>
          <FormField id="email" label={t('common.email')} error={errors.email?.message}>
            <Input id="email" type="email" {...register('email')} />
          </FormField>
          <FormField id="phone" label={t('common.phone')}>
            <Input id="phone" {...register('phone')} />
          </FormField>
          <FormField id="notes" label={t('common.notes')} className="sm:col-span-2">
            <Textarea id="notes" {...register('notes')} />
          </FormField>
        </FormGrid>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
