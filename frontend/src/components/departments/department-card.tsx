"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import type { Department } from "@/lib/types";

interface DepartmentCardProps {
  department: Department & { imageUrl: string; imageHint: string };
  onClick: () => void;
}

export function DepartmentCard({ department, onClick }: DepartmentCardProps) {
  return (
    <Card
      onClick={onClick}
      className="group relative overflow-hidden rounded-lg shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent z-10" />
      <Image
        src={department.imageUrl}
        alt={department.name}
        fill
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        data-ai-hint={department.imageHint}
      />
      <CardContent className="relative z-20 flex h-48 items-end justify-start p-4">
        <h3 className="text-2xl font-bold text-white font-headline">
          {department.name}
        </h3>
      </CardContent>
    </Card>
  );
}