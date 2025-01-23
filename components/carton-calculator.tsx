"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator } from "lucide-react";

export function CartonCalculator() {
  const [cartons, setCartons] = useState<string>("");
  const [pieces, setPieces] = useState<string>("");
  const [unitsPerCarton, setUnitsPerCarton] = useState<string>("24");

  const handleCartonChange = (value: string) => {
    setCartons(value);
    if (value && !isNaN(Number(value)) && !isNaN(Number(unitsPerCarton))) {
      setPieces((Number(value) * Number(unitsPerCarton)).toString());
    } else {
      setPieces("");
    }
  };

  const handlePiecesChange = (value: string) => {
    setPieces(value);
    if (
      value &&
      !isNaN(Number(value)) &&
      !isNaN(Number(unitsPerCarton)) &&
      Number(unitsPerCarton) !== 0
    ) {
      setCartons((Number(value) / Number(unitsPerCarton)).toString());
    } else {
      setCartons("");
    }
  };

  const handleUnitsPerCartonChange = (value: string) => {
    setUnitsPerCarton(value);
    if (cartons && !isNaN(Number(cartons)) && !isNaN(Number(value))) {
      setPieces((Number(cartons) * Number(value)).toString());
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Carton Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="unitsPerCarton">Units per Carton</Label>
          <Input
            id="unitsPerCarton"
            type="number"
            value={unitsPerCarton}
            onChange={(e) => handleUnitsPerCartonChange(e.target.value)}
            placeholder="Units per carton"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cartons">Cartons</Label>
          <Input
            id="cartons"
            type="number"
            value={cartons}
            onChange={(e) => handleCartonChange(e.target.value)}
            placeholder="Enter cartons"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pieces">Pieces</Label>
          <Input
            id="pieces"
            type="number"
            value={pieces}
            onChange={(e) => handlePiecesChange(e.target.value)}
            placeholder="Enter pieces"
          />
        </div>
      </CardContent>
    </Card>
  );
}
