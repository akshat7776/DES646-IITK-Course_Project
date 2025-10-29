import { notFound } from 'next/navigation';
import Image from 'next/image';
import { products } from '@/lib/data';
import { getImageById } from '@/lib/images';
import { calculateAverageRating, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RatingStars } from '@/components/rating-stars';
import { ReviewCard } from '@/components/review-card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Diamond, Footprints, Shirt, User } from 'lucide-react';

const departmentIcons: { [key: string]: React.ReactNode } = {
  Womens: <Shirt className="h-4 w-4" />,
  Mens: <User className="h-4 w-4" />,
  Jewelry: <Diamond className="h-4 w-4" />,
  Shoes: <Footprints className="h-4 w-4" />,
};

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = products.find((p) => p.id === params.id);

  if (!product) {
    notFound();
  }

  const productImage = getImageById(product.imageId);
  const averageRating = calculateAverageRating(product.reviews);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="grid md:grid-cols-2 gap-12 items-start">
        <div className="flex justify-center items-center">
          <Card className="overflow-hidden shadow-2xl rounded-2xl w-full">
            <CardContent className="p-0">
              {productImage && (
                <Image
                  src={productImage.imageUrl}
                  alt={product.name}
                  width={600}
                  height={800}
                  className="object-cover w-full h-auto"
                  data-ai-hint={productImage.imageHint}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="py-1 px-3 text-sm">
                {departmentIcons[product.department]}
                <span className="ml-2">{product.department}</span>
              </Badge>
              <p className="text-sm text-muted-foreground">{product.productAge} on market</p>
            </div>
            <h1 className="text-5xl font-bold tracking-tight">{product.name}</h1>
            <div className="flex items-center gap-2">
              <RatingStars rating={averageRating} />
              <span className="text-muted-foreground text-lg">
                ({averageRating.toFixed(1)} from {product.reviews.length} reviews)
              </span>
            </div>
          </div>
          
          <Separator />

          <div>
            <h2 className="text-3xl font-bold mb-6">Customer Feedback</h2>
            <div className="space-y-6">
              {product.reviews.length > 0 ? (
                product.reviews.map(review => (
                    <ReviewCard key={review.id} review={review} />
                ))
              ) : (
                <p className="text-muted-foreground">No reviews for this product yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
