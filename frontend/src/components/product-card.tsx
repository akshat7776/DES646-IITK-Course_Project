import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RatingStars } from '@/components/rating-stars';
import { getImageById } from '@/lib/images';
import type { Product } from '@/lib/types';

interface ProductCardProps {
  product: Product & { averageRating: number };
}

export function ProductCard({ product }: ProductCardProps) {
  const productImage = getImageById(product.imageId);

  return (
    <Link href={`/products/${product.id}`} className="group">
      <Card className="h-full flex flex-col overflow-hidden rounded-lg shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
        <CardHeader className="p-0">
          {productImage && (
            <div className="overflow-hidden aspect-[3/4]">
              <Image
                src={productImage.imageUrl}
                alt={product.name}
                width={600}
                height={800}
                className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                data-ai-hint={productImage.imageHint}
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="p-4 flex-grow">
          <Badge variant="outline" className="mb-2">{product.department}</Badge>
          <CardTitle className="text-lg font-headline leading-tight">{product.name}</CardTitle>
        </CardContent>
        <CardFooter className="p-4 pt-0 flex items-center justify-between">
          <RatingStars rating={product.averageRating} />
          <span className="text-xs text-muted-foreground">{product.productAge}</span>
        </CardFooter>
      </Card>
    </Link>
  );
}
