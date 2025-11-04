"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DepartmentClientPage } from "@/components/departments/department-client-page";
import type { Department, Product, Review } from "@/lib/types";

// Simple helper to make a stable slug/id
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Rotate through known placeholder image ids
const imageIds = [
  "product-1",
  "product-2",
  "product-3",
  "product-4",
  "product-5",
  "product-6",
  "product-7",
  "product-8",
];

export default function DepartmentBrowser() {
  const [data, setData] = useState<Record<string, Record<string, any[]>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch("/api/reviews")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || res.statusText);
        return res.json();
      })
      .then((json) => {
        if (!mounted) return;
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "Failed to load reviews data");
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const departments: (Department & { imageUrl: string; imageHint: string })[] = useMemo(() => {
    if (!data) return [];

    const result: (Department & { imageUrl: string; imageHint: string })[] = [];
    const deptNames = Object.keys(data);

    deptNames.forEach((deptName, di) => {
      const classes = data[deptName] || {};
      const products: Product[] = [];
      const classNames = Object.keys(classes);

      classNames.forEach((className, ci) => {
        const records = (classes as any)[className] as any[];
        const reviews: Review[] = records.map((r: any, idx: number) => {
          const rating = Number(r.Rating ?? r.rating ?? 0) || 0;
          const ageNum = r.Age !== undefined ? Number(r.Age) : undefined;
          const clothing = r["Clothing ID"] !== undefined ? Number(r["Clothing ID"]) : undefined;
          const title = r.Title ?? r.title ?? "";
          const text = r["Review Text"] ?? r.review ?? r.text ?? "";
          return {
            id: idx + 1,
            author: title || "Anonymous",
            date: "2024-01-01", // placeholder
            rating,
            text,
            title,
            age: Number.isFinite(ageNum) ? (ageNum as number) : undefined,
            clothingId: Number.isFinite(clothing) ? (clothing as number) : undefined,
          };
        });

        // Map class name to a specific placeholder id when available; fallback to rotation
        const canonical = className.trim();
        const knownIds = new Set<string>([
          "Dresses","Knits","Blouses","Sweaters","Pants","Jeans","Fine gauge","Skirts","Jackets","Lounge","Swim","Outerwear","Shorts","Sleep","Legwear","Intimates","Layering","Trend","Casual bottoms","Chemises"
        ]);
        const imageId = knownIds.has(canonical) ? canonical : (className.toLowerCase().includes("sleep") ? "Sleep" : imageIds[(di + ci) % imageIds.length]);
        const product: Product = {
          id: `${slugify(deptName)}-${slugify(className)}`,
          name: className,
          department: deptName,
          productAge: "",
          imageId,
          reviews,
        };
        products.push(product);
      });

      // Department cover images under public/images/departments
      // Drop SVG placeholders into that folder (intimate.svg, dresses.svg, bottoms.svg, tops.svg, jackets.svg, trend.svg, lounge.svg, default.svg)
      const imageUrlHints: Record<string, { imageUrl: string; imageHint: string }> = {
        Intimate: {
          imageUrl: "/images/departments/intimate.svg",
          imageHint: "sleepwear, intimates",
        },
        Dresses: {
          imageUrl: "/images/departments/dresses.jpg",
          imageHint: "dresses rack, apparel",
        },
        Bottoms: {
          imageUrl: "/images/departments/bottoms.jpg",
          imageHint: "pants, jeans, skirts",
        },
        Tops: {
          imageUrl: "/images/departments/tops.jpg",
          imageHint: "blouses, tees, shirts",
        },
        Jackets: {
          imageUrl: "/images/departments/jackets.jpg",
          imageHint: "jackets, outerwear",
        },
        Trend: {
          imageUrl: "/images/departments/default.svg",
          imageHint: "trendy apparel",
        },
        Lounge: {
          imageUrl: "/images/departments/tops.jpg",
          imageHint: "loungewear, cozy",
        },
        default: {
          imageUrl: "/images/departments/default.svg",
          imageHint: "fashion department",
        },
      };

      const hint = imageUrlHints[deptName] || imageUrlHints.default;
      result.push({
        name: deptName,
        classes: products,
        imageUrl: hint.imageUrl,
        imageHint: hint.imageHint,
      });
    });

    return result;
  }, [data]);

  if (loading) return <p>Loading departments…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!departments.length) return <p>No departments found.</p>;

  return <DepartmentClientPage departments={departments} />;
}
