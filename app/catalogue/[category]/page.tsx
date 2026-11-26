import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="furniture-catalogue-body">
      <Link className="furniture-catalogue-back" href="/">Retour à l’accès</Link>
      <h1>{current.label}</h1>
      <p>Photos d’illustration. Origine de fabrication à confirmer auprès du fournisseur.</p>
      <FurnitureGallery photos={current.photos}/>
    </div>
  </main>;
}
