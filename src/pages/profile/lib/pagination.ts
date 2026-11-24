export const countPages = (total: number) => Math.ceil(total / 24);

export const pageItems = (page: number, total: number, compact: boolean) => {
  const desktop = [1, 2, 3, 4, 5, page, total - 4, total - 3, total - 2, total - 1, total];
  const mobile = page === 1 ? [1, 2, total] : page === total ? [1, total - 1, total] : [page - 1, page, page + 1];
  const visible = [...new Set((compact ? mobile : desktop).filter((number) => number >= 1 && number <= total))].sort(
    (a, b) => a - b,
  );

  return [...visible, total + 1].flatMap((number, index) => {
    const previous = visible[index - 1] ?? 0;
    const gap = number > previous + 1 ? [{ from: previous + 1, to: number - 1, skipped: true }] : [];

    return number <= total ? [...gap, { from: number, to: number, skipped: false }] : gap;
  });
};
