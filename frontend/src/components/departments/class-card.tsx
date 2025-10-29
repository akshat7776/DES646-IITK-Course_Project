"use client";

import Image from "next/image";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Product } from "@/lib/types";
import { getImageById } from "@/lib/images";

interface ClassCardProps {
  product: Product;
  onClick: () => void;
}

export function ClassCard({ product, onClick }: ClassCardProps) {
  const productImage = getImageById(product.imageId);
  return (
    <Card
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-lg shadow-sm transition-all duration-300 hover:shadow-lg hover:bg-muted/50 cursor-pointer"
    >
      <CardHeader className="flex flex-row items-start gap-4 p-4">
        {productImage && (
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md">
            <Image
              src={productImage.imageUrl}
              alt={product.name}
              fill
              className="object-cover"
              data-ai-hint={productImage.imageHint}
            />
          </div>
        )}
        <div className="flex-grow">
          <CardTitle className="text-lg font-headline leading-tight">
            {product.name}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">ID: {product.id}</p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground">{product.reviews.length} reviews</p>
      </CardContent>
    </Card>
  );
}
