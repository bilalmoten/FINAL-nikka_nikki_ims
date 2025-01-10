import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export function useDashboardQuery() {
    const supabase = createClientComponentClient();
    const queryClient = useQueryClient();

    // Get the current date for filtering
    const today = new Date().toISOString().split('T')[0];
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const {
        data: products,
        isLoading: productsLoading,
    } = useQuery({
        queryKey: ["products"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("products")
                .select("*")
                .order('name', { ascending: true });
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    });

    const {
        data: salesData,
        isLoading: salesLoading,
    } = useQuery({
        queryKey: ["sales"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("sales")
                .select("*")
                .gte('sale_date', last30Days)
                .order('sale_date', { ascending: false });
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 5,
    });

    const {
        data: purchasesData,
        isLoading: purchasesLoading,
    } = useQuery({
        queryKey: ["purchases"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("purchases")
                .select("*")
                .gte('purchase_date', last30Days)
                .order('purchase_date', { ascending: false });
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 5,
    });

    const {
        data: productionData,
        isLoading: productionLoading,
    } = useQuery({
        queryKey: ["production"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("production")
                .select("*")
                .gte('production_date', last30Days)
                .order('production_date', { ascending: false });
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 5,
    });

    const {
        data: wastageData,
        isLoading: wastageLoading,
    } = useQuery({
        queryKey: ["wastage"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("wastage")
                .select(`
                    *,
                    product:products (
                        name
                    )
                `)
                .gte('wastage_date', last30Days)
                .order('wastage_date', { ascending: false });
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 5,
    });

    // Calculate summary data
    const summary = {
        totalSales: salesData?.reduce((sum, s) => sum + (s.price || 0), 0) || 0,
        totalPurchases: purchasesData?.reduce((sum, p) => sum + (p.price || 0), 0) || 0,
        todayProduction: productionData?.filter(p => p.production_date === today)
            .reduce((sum, p) => sum + (p.quantity || 0), 0) || 0,
        todayWastage: wastageData?.filter(w => w.wastage_date === today)
            .reduce((sum, w) => sum + (w.quantity || 0), 0) || 0,
        recentWastage: wastageData?.slice(0, 5).map(w => ({
            product: w.product.name,
            quantity: w.quantity,
            date: w.wastage_date,
            reason: w.reason
        })) || []
    };

    const isLoading = productsLoading || salesLoading || purchasesLoading || productionLoading || wastageLoading;

    const refreshAll = () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["sales"] });
        queryClient.invalidateQueries({ queryKey: ["purchases"] });
        queryClient.invalidateQueries({ queryKey: ["production"] });
        queryClient.invalidateQueries({ queryKey: ["wastage"] });
    };

    return {
        products,
        salesData,
        purchasesData,
        productionData,
        wastageData,
        summary,
        isLoading,
        refreshAll,
    };
} 