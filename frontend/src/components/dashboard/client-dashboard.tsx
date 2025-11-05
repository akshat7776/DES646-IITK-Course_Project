
"use client";

import { useState, useMemo, useEffect } from "react";
import type { Product } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SentimentDistributionChart } from "./sentiment-distribution-chart";
import { EmotionBreakdownChart } from "./emotion-breakdown-chart";
import { DepartmentRatingChart } from "./department-rating-chart";
import { calculateAverageRating, getNPSCategory } from "@/lib/utils";
import { Star, Users } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { Separator } from "../ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AnalyzedReview = {
  text: string;
  rating: number;
  department: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  emotion: string;
};

type SummaryStats = {
  totalReviews: number;
  averageRating: number;
  nps: number;
  positiveSentimentPercentage: number;
};

type AnalyticsData = {
  analyzedReviews: AnalyzedReview[];
  departmentRatings: { department: string; averageRating: number }[];
  summary?: SummaryStats; // global summary from backend (full dataset)
  sentimentCounts?: { positive?: number; negative?: number; neutral?: number };
  emotionCounts?: { emotion: string; count: number }[];
  npsExact?: number; // exact NPS from backend for current filter
};

export function ClientDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("All");
  // Preserve a master list of departments so the dropdown always shows all options
  const [departmentsMaster, setDepartmentsMaster] = useState<string[]>([]);

  useEffect(() => {
    const getDashboardData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedDepartment && selectedDepartment !== 'All') {
          params.set('department', selectedDepartment);
        }
        const url = `/api/dashboard${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, { method: 'GET', cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Dashboard API ${res.status}`);
        }
        const data = await res.json();
        const analyzedReviews: AnalyzedReview[] = (data.reviews || []).map((r: any) => ({
          text: String(r.text || ''),
          rating: Number(r.rating || 0),
          department: String(r.department || 'Unknown'),
          sentiment: (r.sentiment || 'neutral') as 'positive' | 'negative' | 'neutral',
          emotion: String(r.emotion || 'neutral'),
        }));
        const departmentRatings = (data.department_ratings || []).map((d: any) => ({
          department: String(d.department),
          averageRating: Number(d.averageRating || 0),
        }));
        // Update the master list only when we see a longer (more complete) list
        const fromRatings: string[] = departmentRatings.map((d: { department: string }) => d.department).filter(Boolean);
        if (fromRatings.length) {
          setDepartmentsMaster(prev => {
            // keep the longer list to avoid shrinking to a filtered subset
            const prevSet = new Set(prev);
            const nextSet = new Set(fromRatings);
            // If previous already seems more complete, keep it
            if (prevSet.size >= nextSet.size) return Array.from(prevSet) as string[];
            return Array.from(nextSet) as string[];
          });
        }
        // Pull precomputed global summary stats from backend when available
        const summary: SummaryStats = {
          totalReviews: Number(data.total_reviews ?? analyzedReviews.length ?? 0),
          averageRating: Number(data.average_rating ?? 0),
          nps: Number(data.nps ?? 0),
          positiveSentimentPercentage: Number(data.positive_sentiment_pct ?? 0),
        };
  const sentimentCounts = data.sentiment_counts as AnalyticsData['sentimentCounts'];
  const emotionCounts = data.emotion_counts as AnalyticsData['emotionCounts'];
  const npsExact = typeof data.nps === 'number' ? Number(data.nps) : undefined;
  setData({ analyzedReviews, departmentRatings, summary, sentimentCounts, emotionCounts, npsExact });
      } catch (err) {
        console.error('Failed to load dashboard data', err);
        setData({ analyzedReviews: [], departmentRatings: [] });
      } finally {
        setIsLoading(false);
      }
    };

    getDashboardData();
  }, [selectedDepartment]);

  const departments = useMemo(() => {
    // If we have a preserved master list, always use it
    if (departmentsMaster.length) return ["All", ...departmentsMaster];
    if (!data) return ["All"];
    // Prefer the authoritative list from backend aggregates
    const fromRatings = (data.departmentRatings || []).map(d => d.department).filter(Boolean);
    if (fromRatings.length) return ["All", ...fromRatings];
    // Fallback: derive from sampled reviews (may be incomplete)
    const depts = new Set<string>();
    data.analyzedReviews.forEach(r => depts.add(r.department));
    return ["All", ...Array.from(depts)];
  }, [departmentsMaster, data]);

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
    // If viewing All and we have summary, use exact full-dataset stats
    if (selectedDepartment === 'All' && data?.summary) {
      return data.summary;
    }
    // For department views, if we have aggregated sentiment counts and department average, use them where possible
    if (selectedDepartment !== 'All' && data) {
      const sc = data.sentimentCounts;
      const totalFromCounts = sc ? (Number(sc.positive || 0) + Number(sc.neutral || 0) + Number(sc.negative || 0)) : 0;
      const deptAvgObj = data.departmentRatings.find(d => d.department === selectedDepartment);
      const averageRating = deptAvgObj ? Number(deptAvgObj.averageRating || 0) : calculateAverageRating(filteredData);
      const totalReviews = totalFromCounts || filteredData.length;
      const positiveSentimentPercentage = totalFromCounts
        ? (Number(sc?.positive || 0) / totalFromCounts) * 100
        : (filteredData.length ? (filteredData.filter(r => r.sentiment === 'positive').length / filteredData.length) * 100 : 0);
      // NPS per-department: use exact value from backend when provided, else fallback to sample-based
      let nps = typeof data.npsExact === 'number' ? Number(data.npsExact) : undefined;
      if (typeof nps !== 'number' || Number.isNaN(nps)) {
        const promoters = filteredData.filter(r => getNPSCategory(r.rating) === 'promoter').length;
        const detractors = filteredData.filter(r => getNPSCategory(r.rating) === 'detractor').length;
        nps = filteredData.length > 0 ? ((promoters - detractors) / filteredData.length) * 100 : 0;
      }
      return { totalReviews, averageRating, nps, positiveSentimentPercentage } as SummaryStats;
    }
    // Fallback to sample-based when nothing else is available
    if (!filteredData || filteredData.length === 0) {
      return { totalReviews: 0, averageRating: 0, nps: 0, positiveSentimentPercentage: 0 } as SummaryStats;
    }
    const totalReviews = filteredData.length;
    const averageRating = calculateAverageRating(filteredData);
    const promoters = filteredData.filter(r => getNPSCategory(r.rating) === 'promoter').length;
    const detractors = filteredData.filter(r => getNPSCategory(r.rating) === 'detractor').length;
    const nps = totalReviews > 0 ? ((promoters - detractors) / totalReviews) * 100 : 0;
    const positiveSentiment = filteredData.filter(r => r.sentiment === 'positive').length;
    const positiveSentimentPercentage = totalReviews > 0 ? (positiveSentiment / totalReviews) * 100 : 0;
    return { totalReviews, averageRating, nps, positiveSentimentPercentage } as SummaryStats;
  }, [filteredData, selectedDepartment, data]);

  const allDepartmentsData = useMemo(() => {
    if (!data) return [];
    if (data.departmentRatings?.length) return data.departmentRatings;
    // fallback compute client-side if not provided
    const departmentRatings = departments.filter(d => d !== 'All').map(dept => {
      const deptReviews = data.analyzedReviews.filter(r => r.department === dept);
      return {
        department: dept,
        averageRating: calculateAverageRating(deptReviews)
      }
    });
    return departmentRatings;
  }, [data, departments]);

  // Prefer aggregated emotion counts when they show variety; otherwise fall back to sample data
  const emotionCountsToUse = useMemo(() => {
    const counts = data?.emotionCounts;
    if (!counts || !counts.length) return undefined;
    const unique = new Set(counts.map(c => String(c.emotion || '').toLowerCase()));
    if (unique.size <= 1) return undefined; // degenerate (all one emotion) -> let chart derive from sample data
    const total = counts.reduce((acc, c) => acc + Number(c.count || 0), 0);
    const max = Math.max(...counts.map(c => Number(c.count || 0)));
    if (total > 0 && max / total >= 0.95) return undefined; // overly dominant -> fall back
    return counts;
  }, [data]);

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
                <SentimentDistributionChart data={filteredData} counts={data?.sentimentCounts} />
        <EmotionBreakdownChart data={filteredData} counts={emotionCountsToUse} />
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

    