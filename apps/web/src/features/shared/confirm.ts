/** Confirmación nativa: suficiente para acciones destructivas y accesible por defecto. */
export function confirmAction(message: string): boolean {
  return window.confirm(message);
}
