type Photo = { label: string; image: string; source: string; provider: string };
export type PreviewPhoto = Photo & { fallback?: Photo };

function bigOffice(label: string, image: string, product: string): Photo {
  return {
    label,
    image: `/images/furniture-preview/${image}.webp`,
    source: `https://bigoffice.ma/product/${product}/`,
    provider: "Big Office",
  };
}

export const furnitureCategories: { id: string; label: string; photos: PreviewPhoto[] }[] = [
  {
    id: "bureau",
    label: "Mobilier de bureau",
    photos: [
      bigOffice("Bureau de direction", "office-20835", "bureau-de-direction-design-en-mdf-style-executive-haut-de-gamme"),
      bigOffice("Table de conférence", "office-24784", "table-de-reunion-prestige-360x140-cm-grande-table-de-conference-professionnelle"),
      bigOffice("Bureau multiposte", "office-6015", "bureau-multiposte-4-places-plateau-bois-clair-structure-metallique-blanche-et-separations-grises"),
    ],
  },
  {
    id: "maroc",
    label: "Mobilier de bureau marocain",
    photos: [
      bigOffice("Bureau compact", "moroccan-28065", "bureau-pour-teletravail-100-x-50-cm"),
      bigOffice("Bureau avec caisson", "moroccan-28110", "bureau-en-bois-mdf-140-x-70-x-75-cm-avec-caisson-mobile"),
      bigOffice("Bureau avec retour", "moroccan-27980", "bureau-de-direction-en-mdf-noyer-160-x-80-cm-avec-retour-mobile"),
    ],
  },
  {
    id: "chine",
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
