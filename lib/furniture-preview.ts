type Photo = { label: string; image: string; price: number };
export type PreviewPhoto = Photo & { fallback?: Photo };

function localPhoto(label: string, image: string, price: number): Photo {
  return { label, image: `/images/furniture-preview/${image}.webp`, price };
}

export const furnitureCategories: { id: string; label: string; photos: PreviewPhoto[] }[] = [
  {
    id: "bureau",
    label: "Mobilier de bureau",
    photos: [
      localPhoto("Bureau de direction", "office-20835", 5800),
      localPhoto("Table de conférence", "office-24784", 9200),
      localPhoto("Bureau multiposte", "office-6015", 8600),
    ],
  },
  {
    id: "maroc",
    label: "Mobilier de bureau marocain",
    photos: [
      localPhoto("Bureau compact", "moroccan-28065", 1250),
      localPhoto("Bureau avec caisson", "moroccan-28110", 2450),
      localPhoto("Bureau avec retour", "moroccan-27980", 4200),
    ],
  },
  {
    id: "chine",
    label: "Mobilier de bureau de Chine",
    photos: [
      {
        label: "Postes de travail séparés",
        image: "https://file.sunonglobal.com/wp-content/uploads/2025/08/1107_588.jpg",
        price: 7800,
        fallback: localPhoto("Comptoir d’accueil", "office-7591", 4900),
      },
      {
        label: "Bureaux réglables avec cloisons",
        image: "https://www.isunon.com/upload/at/image/20240220/1708432243664457iiv5.jpg",
        price: 9400,
        fallback: localPhoto("Bibliothèque de bureau", "office-5022", 3600),
      },
      {
        label: "Postes assis-debout",
        image: "https://www.isunon.com/upload/2021/02/19/16137276890201kb664.jpg",
        price: 6800,
        fallback: localPhoto("Salon d’accueil", "office-16924", 6200),
      },
    ],
  },
];
