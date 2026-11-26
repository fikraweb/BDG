"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Photo = { label: string; image: string; source: string; provider: string };
type PreviewPhoto = Photo & { fallback?: Photo };

function bigOffice(label: string, image: string, product: string): Photo {
  return {
    label,
    image: `/images/furniture-preview/${image}.webp`,
    source: `https://bigoffice.ma/product/${product}/`,
    provider: "Big Office",
  };
}

const categories: { id: string; label: string; photos: PreviewPhoto[] }[] = [
  {
    id: "office",
    label: "Mobilier de bureau",
    photos: [
      bigOffice("Bureau de direction", "office-20835", "bureau-de-direction-design-en-mdf-style-executive-haut-de-gamme"),
      bigOffice("Table de conférence", "office-24784", "table-de-reunion-prestige-360x140-cm-grande-table-de-conference-professionnelle"),
      bigOffice("Bureau multiposte", "office-6015", "bureau-multiposte-4-places-plateau-bois-clair-structure-metallique-blanche-et-separations-grises"),
    ],
  },
  {
    id: "morocco",
    label: "Mobilier de bureau marocain",
    photos: [
      bigOffice("Bureau compact", "moroccan-28065", "bureau-pour-teletravail-100-x-50-cm"),
      bigOffice("Bureau avec caisson", "moroccan-28110", "bureau-en-bois-mdf-140-x-70-x-75-cm-avec-caisson-mobile"),
      bigOffice("Bureau avec retour", "moroccan-27980", "bureau-de-direction-en-mdf-noyer-160-x-80-cm-avec-retour-mobile"),
    ],
  },
  {
    id: "china",
    label: "Mobilier de bureau de Chine",
    photos: [
      {
        label: "Postes de travail séparés",
        image: "https://file.sunonglobal.com/wp-content/uploads/2025/08/1107_588.jpg",
        source: "https://www.sunonglobal.com/product-category/products/panel-space-division/panel-system/",
        provider: "Sunon",
        fallback: bigOffice("Comptoir d’accueil", "office-7591", "marbra"),
      },
      {
        label: "Bureaux réglables avec cloisons",
        image: "https://www.isunon.com/upload/at/image/20240220/1708432243664457iiv5.jpg",
        source: "https://www.isunon.com/health/detail/581.html",
        provider: "Sunon",
        fallback: bigOffice("Bibliothèque de bureau", "office-5022", "bibliotheque-de-bureau-en-bois-design-avec-niches-et-portes-decoratives"),
      },
      {
        label: "Postes assis-debout",
        image: "https://www.isunon.com/upload/2021/02/19/16137276890201kb664.jpg",
        source: "https://www.isunon.com/product/detail/151.html",
        provider: "Sunon",
        fallback: bigOffice("Salon d’accueil", "office-16924", "salon-daccueil-professionnel-8072-311-en-simili-cuir"),
      },
    ],
  },
];

function FurniturePhoto({ photo }: { photo: PreviewPhoto }) {
  const [failed, setFailed] = useState(false);
  const displayed = failed ? photo.fallback : photo;

  return <figure className="furniture-preview-photo">
    {displayed && <img src={displayed.image} alt={displayed.label} loading="lazy" onError={() => setFailed(true)}/>}
    <figcaption>
      <strong>{displayed?.label ?? photo.label}</strong>
      {failed && displayed && <span> · Illustration de remplacement</span>}
      {" · "}
      <a href={(displayed ?? photo).source} target="_blank" rel="noreferrer">{(displayed ?? photo).provider}</a>
    </figcaption>
  </figure>;
}

export default function FurniturePreview() {
  const [category, setCategory] = useState(categories[0]);

  return <Sheet>
    <SheetTrigger asChild>
      <button type="button" className="furniture-preview-trigger"><Menu size={18}/>Mobilier de bureau</button>
    </SheetTrigger>
    <SheetContent side="left" className="furniture-preview-sheet">
      <SheetTitle>Mobilier de bureau</SheetTitle>
      <SheetDescription>Photos d’illustration. Origine de fabrication à confirmer auprès du fournisseur.</SheetDescription>
      <nav className="furniture-preview-categories" aria-label="Catégories de mobilier">
        {categories.map(item => <button key={item.id} type="button" aria-pressed={category.id === item.id} onClick={() => setCategory(item)}>{item.label}</button>)}
      </nav>
      <section className="furniture-preview-photos" aria-label={category.label}>
        {category.photos.map(photo => <FurniturePhoto key={photo.image} photo={photo}/>)}
      </section>
    </SheetContent>
  </Sheet>;
}
