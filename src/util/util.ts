import { validFileExtensions, videoFileExtension } from "../models/workoutLog";

export const millisecondsInDay: number = 1000 * 60 * 60 * 24;
export const millisecondsInWeek: number = 1000 * 60 * 60 * 24 * 7;

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
  date.setTime(date.getTime() - timeDifference);
  return date;
}

type videoFileMimeType = "video/quicktime" | "video/mp4" | "video/x-msvideo";
export function isValidFileType(fileType: string): boolean {
  const validFileTypes: videoFileMimeType[] = [
    "video/quicktime",
    "video/mp4",
    "video/x-msvideo",
  ];
  return validFileTypes.includes(fileType as videoFileMimeType);
}

export function isValidFileExtension(extension: string): boolean {
  return validFileExtensions.includes(extension as videoFileExtension);
}
