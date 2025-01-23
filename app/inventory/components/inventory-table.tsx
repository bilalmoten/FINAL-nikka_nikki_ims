import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatGiftSetQuantity } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Product {
  id: number;
  name: string;
  quantity: number;
}

interface InventoryTableProps {
  data: Product[];
}

export function InventoryTable({ data }: InventoryTableProps) {
  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product Name</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((product) => {
            const quantity = formatGiftSetQuantity(
              product.quantity,
              product.name
            );
            return (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell className="text-right">
                  {product.name.toLowerCase().includes("gift set") ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{quantity.display}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total: {quantity.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    quantity.display
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
