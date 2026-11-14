import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { isRoleCode, ROLE_NAMES } from '@alcaravan/shared';
import { errorMessage } from '@/api/error-message';
import { FormField } from '@/components/form-field';
import { ErrorNotice, Notice, Page, PageHeader, Panel } from '@/components/page';
import { useToast } from '@/components/toast-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/use-auth';
import { date } from '@/lib/format';

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'validation.required'),
    new_password: z.string().min(12, 'profile.passwordTooShort').max(128),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ['confirm_password'],
    message: 'profile.passwordMismatch',
  })
  .refine((v) => v.new_password !== v.current_password, {
    path: ['new_password'],
    message: 'profile.passwordSame',
  });
type PasswordValues = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user) return null;
  const roles = user.roles.map((role) => (isRoleCode(role) ? ROLE_NAMES[role] : role));

  return (
    <Page>
      <PageHeader
        eyebrow={t('profile.eyebrow')}
        title={t('profile.title')}
        description={t('profile.subtitle')}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title={t('profile.account')}>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[9rem_1fr]">
            <dt className="text-muted-foreground">{t('profile.email')}</dt>
            <dd className="font-semibold break-all">{user.email}</dd>
            <dt className="text-muted-foreground">{t('profile.roles')}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {roles.length
                ? roles.map((role) => (
                    <Badge key={role} tone="info">
                      {role}
                    </Badge>
                  ))
                : '—'}
            </dd>
            <dt className="text-muted-foreground">{t('profile.lastLogin')}</dt>
            <dd>
              {user.last_login_at
                ? `${date(user.last_login_at.slice(0, 10))} ${user.last_login_at.slice(11, 16)} UTC`
                : '—'}
            </dd>
            <dt className="text-muted-foreground">{t('profile.permissions')}</dt>
            <dd>{t('profile.permissionCount', { count: user.permissions.length })}</dd>
          </dl>
        </Panel>
        <ChangePasswordPanel />
      </div>
    </Page>
  );
}

function ChangePasswordPanel() {
  const { t } = useTranslation();
  const { changePassword } = useAuth();
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      });
      reset();
      toast.show(t('profile.passwordChanged'), 'success');
    } catch (error) {
      setSubmitError(errorMessage(error, t));
    }
  });

  const type = visible ? 'text' : 'password';
  return (
    <Panel
      title={t('profile.changePassword')}
      actions={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
        >
          {visible ? <EyeOff /> : <Eye />} {visible ? t('profile.hide') : t('profile.show')}
        </Button>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Notice>{t('profile.passwordHint')}</Notice>
        <FormField
          id="current_password"
          label={t('profile.currentPassword')}
          error={errors.current_password?.message}
        >
          <Input
            id="current_password"
            type={type}
            autoComplete="current-password"
            {...register('current_password')}
          />
        </FormField>
        <FormField
          id="new_password"
          label={t('profile.newPassword')}
          error={errors.new_password?.message}
          hint={t('profile.newPasswordHint')}
        >
          <Input
            id="new_password"
            type={type}
            autoComplete="new-password"
            {...register('new_password')}
          />
        </FormField>
        <FormField
          id="confirm_password"
          label={t('profile.confirmPassword')}
          error={errors.confirm_password?.message}
        >
          <Input
            id="confirm_password"
            type={type}
            autoComplete="new-password"
            {...register('confirm_password')}
          />
        </FormField>
        <ErrorNotice message={submitError} />
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            <KeyRound /> {isSubmitting ? t('profile.saving') : t('profile.changePassword')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
