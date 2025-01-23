import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@supabase/ssr";

export function useDashboardQuery() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
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
        data: locations,
        isLoading: locationsLoading,
    } = useQuery({
        queryKey: ["locations"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("locations")
                .select("*")
                .order('name', { ascending: true });
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 5,
    });

    const {
        data: locationProducts,
        isLoading: locationProductsLoading,
    } = useQuery({
        queryKey: ["locationProducts"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("location_products")
                .select("*");
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 5,
    });

    // Calculate stock per location using location_products
    const stockByLocation = locations?.reduce((acc, location) => {
        acc[location.id] = products?.map(product => {
            const locationProduct = locationProducts?.find(lp =>
                lp.location_id === location.id &&
                lp.product_id === product.id
            );
            return {
                ...product,
                quantity: locationProduct?.quantity || 0
            };
        }) || [];
        return acc;
    }, {} as Record<number, typeof products>);

    return {
        products,
        productsLoading,
        salesData,
        salesLoading,
        locations,
        locationsLoading,
        locationProducts,
        locationProductsLoading,
        stockByLocation
    };
} 