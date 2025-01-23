import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGiftSetQuantity(quantity: number, productName?: string): { display: string; tooltip: string } {
  if (!productName || !productName.toLowerCase().includes('gift set')) {
    return {
      display: `${quantity} pcs`,
      tooltip: `${quantity} pcs`
    };
  }

  const cartons = Math.floor(quantity / 24);
  const pieces = quantity % 24;

  // Format for the main display (carton-based)
  let display = '';
  if (cartons > 0) {
    display = pieces > 0 ? `${cartons} ctn + ${pieces} pcs` : `${cartons} ctn`;
  } else {
    display = `${quantity} pcs`;
  }

  // Format for the tooltip (show both formats)
  const tooltip = cartons > 0
    ? `${quantity} pcs (${cartons} cartons${pieces > 0 ? ` + ${pieces} pcs` : ''})`
    : `${quantity} pcs`;

  return { display, tooltip };
}
