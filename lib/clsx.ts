// Tiny classNames helper (avoids an extra dependency).
export function clsx(
  ...args: (string | false | null | undefined)[]
): string {
  return args.filter(Boolean).join(" ");
}
