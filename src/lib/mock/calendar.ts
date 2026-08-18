const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getMonthGrid(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return { weeks, weekdayLabels: WEEKDAY_LABELS, monthLabel: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
}

export function getWeekDays(date: Date) {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    return { date: day.getDate(), weekdayLabel: WEEKDAY_LABELS[i] };
  });
}
