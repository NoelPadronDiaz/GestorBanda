import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { errorMessage } from '@/api/error-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from './use-auth';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'validation.required').pipe(z.email('validation.email')),
  password: z.string().min(1, 'validation.required'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t } = useTranslation();
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
  const destination = from ? `${from.pathname}${from.search ?? ''}` : '/';

  if (status === 'authenticated') return <Navigate to={destination} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
      void navigate(destination, { replace: true });
    } catch (error) {
      setSubmitError(errorMessage(error, t));
    }
  });

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar px-12 py-12 text-sidebar-foreground lg:flex">
        <div
          className="pointer-events-none absolute -top-40 -right-40 size-[28rem] rounded-full border-[3rem] border-gold/10"
          aria-hidden
        />
        <div className="relative flex items-center gap-4">
          <img src="/brand/alcaravan-logo-256.png" alt="" className="size-20 object-contain" />
          <div className="leading-tight">
            <p className="text-xl font-bold tracking-[0.14em] text-sidebar-strong">
              {t('app.name')}
            </p>
            <p className="text-xs tracking-[0.16em] text-[#b8c5d4] uppercase">{t('app.tagline')}</p>
          </div>
        </div>
        <div className="relative grid max-w-md gap-4">
          <span className="h-1 w-16 rounded-full bg-gold" aria-hidden />
          <p className="text-3xl leading-tight font-semibold text-white">{t('auth.heroTitle')}</p>
          <p className="text-sm leading-relaxed text-[#c9d3df]">{t('auth.heroText')}</p>
        </div>
        <p className="relative text-[11px] text-[#aebdd0]/80">{t('app.footer')}</p>
      </section>
      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-t-4 border-t-gold">
          <CardHeader>
            <img
              src="/brand/app-icon-192.png"
              alt=""
              className="mb-2 size-14 rounded-xl lg:hidden"
            />
            <p className="text-xs font-semibold tracking-[0.2em] text-gold-strong">
              {t('app.name')}
            </p>

            <CardTitle className="text-xl">{t('auth.loginTitle')}</CardTitle>
            <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  aria-invalid={errors.email ? true : undefined}
                  {...register('email')}
                />
                {errors.email?.message && (
                  <p role="alert" className="text-sm text-destructive">
                    {t(errors.email.message)}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors.password ? true : undefined}
                  {...register('password')}
                />
                {errors.password?.message && (
                  <p role="alert" className="text-sm text-destructive">
                    {t(errors.password.message)}
                  </p>
                )}
              </div>
              {submitError && (
                <p
                  role="alert"
                  className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {submitError}
                </p>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('auth.submitting') : t('auth.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
