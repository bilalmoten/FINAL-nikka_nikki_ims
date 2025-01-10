import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { toast } from "@/components/ui/use-toast";

// Types for our mutations
interface RecordSaleInput {
    price: number;
    sale_date: string;
    // Add other fields as needed
}

interface RecordPurchaseInput {
    price: number;
    purchase_date: string;
    // Add other fields as needed
}

interface RecordProductionInput {
    quantity: number;
    production_date: string;
    // Add other fields as needed
}

interface RecordWastageInput {
    quantity: number;
    wastage_date: string;
    // Add other fields as needed
}

export function useMutations() {
    const supabase = createClientComponentClient();
    const queryClient = useQueryClient();

    const recordSale = useMutation({
        mutationFn: async (input: RecordSaleInput) => {
            const { data, error } = await supabase.from("sales").insert(input);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sales"] });
            toast({
                title: "Sale Recorded",
                description: "The sale has been successfully recorded.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "Failed to record sale. Please try again.",
                variant: "destructive",
            });
        },
    });

    const recordPurchase = useMutation({
        mutationFn: async (input: RecordPurchaseInput) => {
            const { data, error } = await supabase.from("purchases").insert(input);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["purchases"] });
            toast({
                title: "Purchase Recorded",
                description: "The purchase has been successfully recorded.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "Failed to record purchase. Please try again.",
                variant: "destructive",
            });
        },
    });

    const recordProduction = useMutation({
        mutationFn: async (input: RecordProductionInput) => {
            const { data, error } = await supabase.from("production").insert(input);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["production"] });
            toast({
                title: "Production Recorded",
                description: "The production has been successfully recorded.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "Failed to record production. Please try again.",
                variant: "destructive",
            });
        },
    });

    const recordWastage = useMutation({
        mutationFn: async (input: RecordWastageInput) => {
            const { data, error } = await supabase.from("wastage").insert(input);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["wastage"] });
            toast({
                title: "Wastage Recorded",
                description: "The wastage has been successfully recorded.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "Failed to record wastage. Please try again.",
                variant: "destructive",
            });
        },
    });

    return {
        recordSale,
        recordPurchase,
        recordProduction,
        recordWastage,
    };
} 