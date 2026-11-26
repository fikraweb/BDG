"use client";
import { useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { productGallery } from "@/lib/product-gallery";
import type { Product } from "@/lib/catalog";

export default function ProductGallery({ product }: { product: Product }) {
  const photos = productGallery(product);
  const [api, setApi] = useState<CarouselApi>(), [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!api) return;
    const update = () => setCurrent(api.selectedScrollSnap());
    update(); api.on("select", update); api.on("reInit", update);
    return () => { api.off("select", update); api.off("reInit", update); };
  }, [api]);
  return <div className="product-gallery">
    <Carousel setApi={setApi} opts={{ loop: false }} aria-label={"Photos de " + product.name}>
      <CarouselContent className="gallery-slides">{photos.map((photo, index) => <CarouselItem key={photo.image}>
        <div className="gallery-main-image"><img src={photo.image} alt={product.name + " · " + photo.label} loading={index ? "lazy" : "eager"} decoding="async"/></div>
      </CarouselItem>)}</CarouselContent>
      <div className="gallery-navigation"><span aria-live="polite">{current + 1} / {photos.length}</span>{photos.length > 1 && <div><CarouselPrevious className="gallery-previous" aria-label="Photo précédente"/><CarouselNext className="gallery-next" aria-label="Photo suivante"/></div>}</div>
    </Carousel>
    <p className="gallery-caption">{photos[current]?.label}</p>
    {photos.length > 1 && <div className="gallery-thumbnails" aria-label="Choisir une photo">{photos.map((photo, index) => <button type="button" key={photo.image} className={index === current ? "selected" : ""} aria-pressed={index === current} aria-label={"Voir la photo " + (index + 1) + " : " + photo.label} onClick={() => api?.scrollTo(index)}><img src={photo.image} alt="" loading="lazy"/></button>)}</div>}
  </div>;
}
