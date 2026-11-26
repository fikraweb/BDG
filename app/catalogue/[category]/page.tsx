import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogueBackLink, FurnitureGallery } from "@/app/furniture-preview";
import { furnitureCategories } from "@/lib/furniture-preview";

type PageProps = { params: Promise<{ category: string }>; searchParams: Promise<{ depuis?: string | string[] }> };

export function generateStaticParams() {
  return furnitureCategories.map(({ id }) => ({ category: id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  return { title: `BDG | ${furnitureCategories.find(({ id }) => id === category)?.label ?? "Catalogue"}` };
}

export default async function FurnitureCatalogue({ params, searchParams }: PageProps) {
  const { category } = await params;
  const current = furnitureCategories.find(({ id }) => id === category);
  if (!current) notFound();
  const { depuis } = await searchParams;

  return <main className="furniture-catalogue bdg-themed">
    <header className="furniture-catalogue-hero">
      <div className="furniture-catalogue-body">
        <CatalogueBackLink fromServices={depuis === "services"}/>
        <h1>{current.label}</h1>
      </div>
    </header>
    <div className="furniture-catalogue-body">
      <p>Photos d’illustration · Prix indicatifs en MAD</p>
      <FurnitureGallery photos={current.photos}/>
    </div>
  </main>;
}
