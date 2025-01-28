export const productPresets = {
    "Nikka Nikki Gift Set 4 Pcs": {
        basePrice: 330,
        priceRules: {
            "258.92": {
                tradeScheme: "12+1",
                discountPercentage: 15,
            },
            "270": {
                tradeScheme: "10+1",
                discountPercentage: 10,
            },
            "265": {
                tradeScheme: "12+1",
                discountPercentage: 13,
            },
            "265.02": {
                tradeScheme: "12+1",
                discountPercentage: 13,
            }
        }
    },
    // Add more products as needed
} as const;

export type ProductPreset = {
    basePrice: number;
    priceRules: {
        [key: string]: {
            tradeScheme: string;
            discountPercentage: number;
        };
    };
};

export function findPriceRule(product: string, enteredPrice: number) {
    console.log("Finding price rule for:", { product, enteredPrice });

    const preset = productPresets[product as keyof typeof productPresets];
    console.log("Found preset:", preset);

    if (!preset) return null;

    // Try both the exact number and the number with 2 decimal places
    const priceKeys = [
        enteredPrice.toString(),                    // "265"
        enteredPrice.toFixed(2)                     // "265.00"
    ];

    console.log("Looking for price keys:", priceKeys);

    // Try each price format
    for (const key of priceKeys) {
        const priceRule = preset.priceRules[key as keyof typeof preset.priceRules];
        if (priceRule) {
            const result = { ...priceRule, basePrice: preset.basePrice };
            console.log("Found matching price rule for key", key, ":", result);
            return result;
        }
    }

    console.log("No matching price rule found");
    return null;
} 