"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { money } from "@/lib/catalog";
import { furnitureCategories, type PreviewPhoto } from "@/lib/furniture-preview";

function FurniturePhoto({ photo }: { photo: PreviewPhoto }) {
  const [failed, setFailed] = useState(false);
  const displayed = failed ? photo.fallback : photo;

  return <figure className="furniture-preview-photo">
    {displayed && <img src={displayed.image} alt={displayed.label} loading="lazy" onError={() => setFailed(true)}/>}
    {displayed && <figcaption>{money(displayed.price)}</figcaption>}
  </figure>;
}

export function FurnitureGallery({ photos }: { photos: PreviewPhoto[] }) {
  return <div className="furniture-preview-photos">
    {photos.map(photo => <FurniturePhoto key={photo.image} photo={photo}/>)}
  </div>;
}

export default function FurniturePreview() {
  return <Sheet>
    <SheetTrigger asChild>
      <button type="button" className="furniture-preview-trigger"><Menu size={18}/>Mobilier de bureau</button>
    </SheetTrigger>
    <SheetContent side="left" className="furniture-preview-sheet">
      <SheetTitle>Mobilier de bureau</SheetTitle>
      <SheetDescription className="sr-only">Choisissez une catégorie.</SheetDescription>
      <nav className="furniture-preview-categories" aria-label="Catégories de mobilier">
        {furnitureCategories.map(category => (
          <a key={category.id} href={`/catalogue/${category.id}`}>{category.label}</a>
        ))}
      </nav>
    </SheetContent>
  </Sheet>;
}
