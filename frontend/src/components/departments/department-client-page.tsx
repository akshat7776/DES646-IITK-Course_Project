"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Department, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DepartmentCard } from "./department-card";
import { ClassCard } from "./class-card";

type DepartmentClientPageProps = {
  departments: (Department & { imageUrl: string; imageHint: string })[];
};

export function DepartmentClientPage({ departments }: DepartmentClientPageProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<
    (Department & { imageUrl: string; imageHint: string }) | null
  >(null);
  const router = useRouter();

  const handleDepartmentClick = (department: Department & { imageUrl: string; imageHint: string }) => {
    setSelectedDepartment(department);
  };

  const handleClassClick = (product: Product) => {
    router.push(`/products/${product.id}`);
  };

  const handleBackToDepartments = () => {
    setSelectedDepartment(null);
  };

  return (
    <div>
      {!selectedDepartment ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.name}
              department={dept}
              onClick={() => handleDepartmentClick(dept)}
            />
          ))}
        </div>
      ) : (
        <div>
          <Button
            variant="ghost"
            onClick={handleBackToDepartments}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Departments
          </Button>
          <h2 className="text-3xl font-bold mb-6 tracking-tight">
            {selectedDepartment.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {selectedDepartment.classes.map((product) => (
              <ClassCard
                key={product.id}
                product={product}
                onClick={() => handleClassClick(product)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
