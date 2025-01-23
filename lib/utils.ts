import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGiftSetQuantity(quantity: number, productName: string) {
  if (!productName.toLowerCase().includes('gift set')) {
    return {
      display: quantity.toString(),
      tooltip: quantity.toString()
    };
  }

  const CARTON_SIZE = 24;
  const cartons = Math.floor(quantity / CARTON_SIZE);
  const pieces = quantity % CARTON_SIZE;

  let display = `${quantity} pcs`;
  if (cartons > 0) {
    display = `${cartons} ctn${cartons > 1 ? 's' : ''}${pieces > 0 ? ` + ${pieces} pcs` : ''}`;
  }

  const tooltip = `${quantity} pieces (${cartons} cartons${pieces > 0 ? ` and ${pieces} pieces` : ''})`;

  return {
    display,
    tooltip
  };
}
