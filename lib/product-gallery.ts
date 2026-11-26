import type { Product, ProductPhoto } from "@/lib/catalog";
import { productGallerySeeds } from "@/lib/product-gallery-seeds";

export function productGallery(product: Pick<Product, "image" | "gallery">): ProductPhoto[] {
  const seen = new Set<string>();
  return [{ image: product.image, label: "Vue d’ensemble" }, ...(product.gallery ?? productGallerySeeds[product.image] ?? [])].filter(photo => {
    if (!photo.image || seen.has(photo.image)) return false;
    seen.add(photo.image); return true;
  });
}
