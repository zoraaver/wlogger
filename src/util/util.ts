// useful constants
export const millisecondsInDay: number = 1000 * 60 * 60 * 24;
export const millisecondsInWeek: number = 1000 * 60 * 60 * 24 * 7;
export const megaByte: number = 1000000;

export function dateDifferenceInWeeks(d1: Date, d2: Date): number {
  return Math.floor(
    (Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate()) -
      Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate())) /
      millisecondsInWeek
  );
}

export function goBackToPreviousMonday(date: Date): Date {
  const day: number = date.getDay();

  let dayDifference: number = day - 1;
  if (dayDifference < 0) dayDifference = 6;

  let timeDifference: number = dayDifference * millisecondsInDay;

  const previousMondayDate = new Date(date.getTime() - timeDifference);
  return previousMondayDate;
}
