import { products } from '@/lib/data';
import { DepartmentClientPage } from '@/components/departments/department-client-page';
import { Product } from '@/lib/types';
import { FeedbackAnalyzer } from '@/components/feedback-analyzer';
import { Separator } from '@/components/ui/separator';

export type Department = {
  name: string;
  classes: Product[];
  imageUrl: string;
  imageHint: string;
};

function getDepartments(): Department[] {
  const departmentsMap: Map<string, Product[]> = new Map();

  products.forEach(product => {
    if (!departmentsMap.has(product.department)) {
      departmentsMap.set(product.department, []);
    }
    departmentsMap.get(product.department)!.push(product);
  });
  
  const departmentImages : Record<string, {imageUrl: string, imageHint: string}> = {
    'Womens': { imageUrl: 'https://images.unsplash.com/photo-1581044777550-4cfa6ce247e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw1fHx3b21lbiUyMGZhc2hpb258ZW58MHx8fHwxNzYxNjIxMjk5fDA&ixlib=rb-4.1.0&q=80&w=1080', imageHint: 'womens fashion' },
    'Mens': { imageUrl: 'https://images.unsplash.com/photo-1507538748366-0565ab4f1df8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw3fHxtZW5zJTIwZmFzaGlvbnxlbnwwfHx8fDE3NjE2MjEyOTl8MA&ixlib=rb-4.1.0&q=80&w=1080', imageHint: 'mens fashion' },
    'Jewelry': { imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw0fHxqc3dlbHJ5fGVufDB8fHx8MTc2MTYyMTI5OXww&ixlib=rb-4.1.0&q=80&w=1080', imageHint: 'jewelry' },
    'Shoes': { imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw1fHxzaG9lc3xlbnwwfHx8fDE3NjE2MjEyOTl8MA&ixlib=rb-4.1.0&q=80&w=1080', imageHint: 'shoes' },
  }

  return Array.from(departmentsMap.entries()).map(([name, classes]) => ({
    name,
    classes,
    imageUrl: departmentImages[name]?.imageUrl ?? 'https://picsum.photos/seed/1/600/400',
    imageHint: departmentImages[name]?.imageHint ?? 'fashion',
  }));
}

export default function Home() {
  const departments = getDepartments();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-5xl font-bold tracking-tight">Product Departments</h1>
        <p className="mt-2 text-lg text-muted-foreground">Explore feedback by category.</p>
      </header>
      <DepartmentClientPage departments={departments} />
    </div>
  );
}
