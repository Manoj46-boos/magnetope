/** Letters typed into a field must reach the field, not steer the game or move focus around a menu. */
export const isTextEntry = (target: EventTarget | null): boolean =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'range'].includes(target.type));
