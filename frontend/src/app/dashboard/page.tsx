
'use client';

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientDashboard } from "@/components/dashboard/client-dashboard";
import { products } from "@/lib/data";
import { analyzeCustomerFeedback } from "@/ai/flows/analyze-customer-feedback";

export default function DashboardPage() {
  // This is now a client component, but we can still show a skeleton during initial load
  // The actual data fetching will happen inside ClientDashboard
  return (
    <div className="flex-1">
        <main className="flex-1">
            <div className="container mx-auto px-4 py-8">
            <header className="mb-8">
                <h1 className="text-5xl font-bold tracking-tight">Analytics Dashboard</h1>
                <p className="mt-2 text-lg text-muted-foreground">
                Aggregated insights from customer feedback.
                </p>
            </header>
            <Suspense fallback={<DashboardSkeleton />}>
                <ClientDashboard />
            </Suspense>
            </div>
        </main>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
        </div>

        <div className="space-y-2">
            <Skeleton className="h-8 w-1/4" />
            <div className="grid gap-8 md:grid-cols-2">
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
            </div>
        </div>
        
        <div className="space-y-2">
            <Skeleton className="h-8 w-1/4" />
            <div className="grid gap-8">
                <Skeleton className="h-64" />
            </div>
        </div>

        <div className="space-y-2">
            <Skeleton className="h-8 w-1/4" />
            <div className="grid gap-8 md:grid-cols-2">
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
            </div>
        </div>
    </div>
  )
}
