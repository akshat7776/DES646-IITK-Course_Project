"use client";

import React, { useEffect, useState } from 'react';

type ReviewsByDept = Record<string, Record<string, string[]>>;

export function ReviewsByDeptViewer() {
  const [data, setData] = useState<ReviewsByDept | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('/api/reviews')
      .then(async res => {
        if (!res.ok) throw new Error((await res.json()).error || res.statusText);
        return res.json();
      })
      .then((json: ReviewsByDept) => {
        if (!mounted) return;
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        if (!mounted) return;
        setError(err.message || 'Failed to load');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="mt-8">Loading reviews by department...</div>;
  if (error) return <div className="mt-8 text-red-600">Error loading reviews: {error}</div>;
  if (!data) return <div className="mt-8">No data available.</div>;

  return (
    <div className="mt-8 space-y-6">
      {Object.entries(data).map(([deptName, classes]) => (
        <section key={deptName} className="border rounded-md p-4">
          <h3 className="text-2xl font-semibold">{deptName}</h3>
          <div className="mt-3 space-y-4">
            {Object.entries(classes).map(([className, reviews]) => (
              <div key={className} className="pl-3">
                <h4 className="text-lg font-medium">{className} <span className="text-sm text-muted-foreground">({reviews.length})</span></h4>
                <ul className="mt-2 list-disc list-inside max-h-48 overflow-auto space-y-1 text-sm">
                  {reviews.map((r, idx) => (
                    <li key={idx} className="whitespace-pre-wrap">{r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default ReviewsByDeptViewer;
