import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/toast-context';
import { errorMessage } from './error-message';

interface ActionOptions<TResult> {
  /** Prefijos de query a refrescar al terminar bien (p. ej. ['billing'] refresca todo Facturación). */
  invalidate?: QueryKey[];
  /** Clave i18n del mensaje de éxito; sin ella no se muestra aviso. */
  success?: string | ((result: TResult) => string);
  onSuccess?: (result: TResult) => void;
}

/**
 * Mutación estándar de la app: muestra el error traducido como aviso, invalida las listas
 * afectadas y confirma con un mensaje. Los formularios pueden leer `error` para mostrarlo en línea.
 */
export function useAction<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  options: ActionOptions<TResult> = {},
) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await Promise.all(
        (options.invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      if (options.success) {
        const message =
          typeof options.success === 'function' ? options.success(result) : t(options.success);
        toast.show(message);
      }
      options.onSuccess?.(result);
    },
    onError: (error) => toast.show(errorMessage(error, t), 'error'),
  });
}
