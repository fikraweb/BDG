import { ApiError } from "@/lib/server";
import { env } from "cloudflare:workers";
import { productPhotoSeeds } from "@/lib/product-photo-seeds";
import { bytesToBase64 } from "@/lib/order-pdf";

type Photo = { data: string; type: "image/jpeg" | "image/png" };
export function photoType(bytes: Uint8Array): Photo["type"] | null {
  if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";
  if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return "image/png";
  return null;
}
async function uploadedPreview(id: string): Promise<Uint8Array|null> {
  const bucket=(env as unknown as {CATALOGUE_IMAGES?:R2Bucket}).CATALOGUE_IMAGES;
  if(!bucket)return null;
  const file=await bucket.get("catalogue/"+id+"-pdf") || await bucket.get("catalogue/"+id);
  return file&&file.size<=80000 ? new Uint8Array(await file.arrayBuffer()) : null;
}
async function readPhoto(image: string): Promise<Photo|null> {
  if(productPhotoSeeds[image])return {data:productPhotoSeeds[image],type:"image/jpeg"};
  const upload=image.match(/^\/api\/catalogue-images\?id=([a-f0-9-]{36})$/);
  if(upload){const bytes=await uploadedPreview(upload[1]);const type=bytes&&photoType(bytes);return bytes&&type?{data:bytesToBase64(bytes),type}:null;}
  // Remote legacy catalogue photos: never fetch arbitrary server-side addresses.
  try {
    const url=new URL(image);
    if(url.protocol!=="https:"||url.port||url.username||url.password||!["bigoffice.ma","images.unsplash.com","images.pexels.com"].includes(url.hostname))return null;
    const response=await fetch(url,{redirect:"error",signal:AbortSignal.timeout(5000)});
    if(!response.ok||Number(response.headers.get("content-length"))>80000)return null;
    const reader=response.body?.getReader();if(!reader)return null;
    const chunks:Uint8Array[]=[];let length=0;
    while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>80000){await reader.cancel();return null;}chunks.push(next.value);}
    const bytes=new Uint8Array(length);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
    const type=photoType(bytes);return type?{data:bytesToBase64(bytes),type}:null;
  }catch{return null;}
}
export async function snapshotProductPhotos(details: Record<string,unknown>) {
  if(!Array.isArray(details.items))return details;
  const byImage=new Map<string,string>();const photos:Record<string,Photo>={};let size=0;
  for(const item of details.items){
    const image=String(item.image||"");if(byImage.has(image))continue;
    const photo=await readPhoto(image);const key="photo-"+(byImage.size+1);byImage.set(image,key);
    if(photo){size+=photo.data.length;if(size>2400000)throw new ApiError("La sélection est trop volumineuse pour un seul PDF. Répartissez-la en plusieurs demandes.");photos[key]=photo;}
  }
  return {...details,photos,items:details.items.map(item=>({...item,photoKey:byImage.get(String(item.image||""))}))};
}
