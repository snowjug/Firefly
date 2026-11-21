export type ClassValue = string | false | null | undefined;

/** Joins class names, skipping anything falsy: `cx('ff-a', active && 'ff-a--active')`. */
export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
