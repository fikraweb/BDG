import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { FurnitureGallery } from "@/app/furniture-preview";
import { furnitureCategories } from "@/lib/furniture-preview";

type PageProps = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return furnitureCategories.map(({ id }) => ({ category: id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  return { title: `BDG | ${furnitureCategories.find(({ id }) => id === category)?.label ?? "Catalogue"}` };
}

export default async function FurnitureCatalogue({ params }: PageProps) {
  const { category } = await params;
  const current = furnitureCategories.find(({ id }) => id === category);
  if (!current) notFound();

  return <main className="furniture-catalogue">
    <header className="furniture-catalogue-hero">
      <div className="furniture-catalogue-body">
        <a className="furniture-catalogue-back" href="/"><ArrowLeft size={18} aria-hidden="true"/>Retour à l’accès</a>
        <h1>{current.label}</h1>
      </div>
    </header>
    <div className="furniture-catalogue-body">
      <p>Photos d’illustration · Prix indicatifs en MAD</p>
      <FurnitureGallery photos={current.photos}/>
    </div>
  </main>;
}
