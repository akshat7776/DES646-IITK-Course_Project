
"use client";

import { useState, useMemo, useEffect } from "react";
import type { Product, Review } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SentimentDistributionChart } from "./sentiment-distribution-chart";
import { EmotionBreakdownChart } from "./emotion-breakdown-chart";
import { DepartmentRatingChart } from "./department-rating-chart";
import { calculateAverageRating, getNPSCategory } from "@/lib/utils";
import { Star, Users } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { products as staticProducts } from "@/lib/data";
import { analyzeCustomerFeedback } from "@/ai/flows/analyze-customer-feedback";
import { Separator } from "../ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AnalyzedReview = Review & {
  productName: string;
  department: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  emotion: string;
  intent: string;
  tags: string[];
};

type AnalyticsData = {
  analyzedReviews: AnalyzedReview[];
  products: Product[];
};

export function ClientDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("All");

  useEffect(() => {
    const getAnalyticsData = async () => {
      setIsLoading(true);
      const allReviews = staticProducts.flatMap(p => 
        p.reviews.map(r => ({ ...r, productName: p.name, department: p.department }))
      );

      const analysisPromises = allReviews.map(review => 
        analyzeCustomerFeedback({ feedback: review.text, productName: review.productName })
          .then(analysis => ({
            ...review,
            ...analysis,
          }))
          .catch(error => {
            console.error("AI analysis failed for a review:", error);
            return {
              ...review,
              sentiment: 'neutral',
              emotion: 'unknown',
              intent: 'unknown',
              tags: [],
            } as AnalyzedReview;
          })
      );
      
      const analyzedReviews = await Promise.all(analysisPromises);
      
      setData({ analyzedReviews, products: staticProducts });
      setIsLoading(false);
    };

    getAnalyticsData();
  }, []);

  const departments = useMemo(() => {
    if (!data) return [];
    return ["All", ...Array.from(new Set(data.products.map(p => p.department)))];
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (selectedDepartment === "All") {
      return data.analyzedReviews;
    }
    return data.analyzedReviews.filter(
      (review) => review.department === selectedDepartment
    );
  }, [selectedDepartment, data]);
  
  const stats = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return { totalReviews: 0, averageRating: 0, nps: 0, positiveSentimentPercentage: 0};

    const totalReviews = filteredData.length;
    const averageRating = calculateAverageRating(filteredData);
    
    const promoters = filteredData.filter(r => getNPSCategory(r.rating) === 'promoter').length;
    const detractors = filteredData.filter(r => getNPSCategory(r.rating) === 'detractor').length;
    const nps = totalReviews > 0 ? ((promoters - detractors) / totalReviews) * 100 : 0;

    const positiveSentiment = filteredData.filter(r => r.sentiment === 'positive').length;
    const positiveSentimentPercentage = totalReviews > 0 ? (positiveSentiment / totalReviews) * 100 : 0;

    return {
      totalReviews,
      averageRating,
      nps,
      positiveSentimentPercentage
    }
  }, [filteredData]);

  const allDepartmentsData = useMemo(() => {
      if (!data) return [];
      const departmentRatings = departments.filter(d => d !== 'All').map(dept => {
          const deptReviews = data.analyzedReviews.filter(r => r.department === dept);
          return {
              department: dept,
              averageRating: calculateAverageRating(deptReviews)
          }
      });
      return departmentRatings;
  }, [data, departments]);

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold tracking-tight">Department Analysis</h2>
            <div className="w-[200px]">
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                        {departments.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.totalReviews}</div>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.averageRating.toFixed(2)}</div>
            </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Positive Sentiment</CardTitle>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.positiveSentimentPercentage.toFixed(0)}%</div>
                </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Promoter Score</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.nps.toFixed(0)}</div>
            </CardContent>
            </Card>
        </div>
        
        <Separator />
        
        <div>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Overall Department Performance</h2>
             <div className="grid gap-8 md:grid-cols-1 mb-8">
                <DepartmentRatingChart data={allDepartmentsData} />
            </div>
        </div>

        <Separator />

        <div>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Sentiment &amp; Emotion Analysis {selectedDepartment !== 'All' && `for ${selectedDepartment}`}</h2>
             <div className="grid gap-8 md:grid-cols-2">
                <SentimentDistributionChart data={filteredData} />
                <EmotionBreakdownChart data={filteredData} />
            </div>
        </div>
    </div>
  );
}


function DashboardSkeleton() {
  return (
    <div className="space-y-8">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold tracking-tight">Department Analysis</h2>
            <Skeleton className="h-10 w-[200px]" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        </div>
        <Separator/>
        <div>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Overall Department Performance</h2>
             <div className="grid gap-8 md:grid-cols-1 mb-8">
                <Skeleton className="h-64" />
            </div>
        </div>
        <Separator/>
        <div>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Sentiment &amp; Emotion Analysis</h2>
            <div className="grid gap-8 md:grid-cols-2">
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
            </div>
        </div>
    </div>
  )
}

    