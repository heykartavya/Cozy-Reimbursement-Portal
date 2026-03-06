import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const SUBMITTERS = [
  "Jitendra",
  "Neil",
  "Naveena",
  "Suresh",
  "Manjunath",
  "Usman",
  "Kartavya",
];

export const CATEGORIES = [
  "Marketing",
  "Operations",
  "Travel",
  "Food & Beverage",
  "Office Supplies",
  "Miscellaneous",
];
