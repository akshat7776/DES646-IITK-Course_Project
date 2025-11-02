import DepartmentBrowser from '@/components/department-browser';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-5xl font-bold tracking-tight">Product Departments</h1>
        
      </header>
      <DepartmentBrowser />
    </div>
  );
}
