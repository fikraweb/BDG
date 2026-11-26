"use client";
import {Ruler} from "lucide-react";
import {Tabs,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from "@/components/ui/select";
import {money,type Product} from "@/lib/catalog";
export type DimensionInputs={length:string;depth:string;height:string};
export default function DimensionSelector({product,sizeId,onSize,custom,onCustom,inputs,onInputs,error}:{product:Product;sizeId:string;onSize:(v:string)=>void;custom:boolean;onCustom:(v:boolean)=>void;inputs:DimensionInputs;onInputs:(v:DimensionInputs)=>void;error?:string}){
 const policy=product.customSizing;
 return <div className="dimension-picker">{policy?.enabled&&<Tabs value={custom?"custom":"preset"} onValueChange={v=>onCustom(v==="custom")}><TabsList className="dimension-tabs"><TabsTrigger value="preset">Tailles proposées</TabsTrigger><TabsTrigger value="custom">Saisir ma taille</TabsTrigger></TabsList></Tabs>}
 {custom&&policy?<><div className="custom-dimensions">{([{key:"length",label:"Longueur",min:policy.minLengthCm,max:policy.maxLengthCm},{key:"depth",label:"Profondeur",min:policy.minDepthCm,max:policy.maxDepthCm},{key:"height",label:"Hauteur",min:policy.minHeightCm,max:policy.maxHeightCm}] as const).map(axis=><label className="field" key={axis.key}>{axis.label} (m)<input type="number" inputMode="decimal" required min={axis.min/100} max={axis.max/100} step="0.01" value={inputs[axis.key]} onChange={e=>onInputs({...inputs,[axis.key]:e.target.value})}/><small>{axis.min/100} à {axis.max/100} m</small></label>)}</div><p className="dimension-price-help">Prix TTC calculé selon {policy.pricing==="length"?"la longueur":policy.pricing==="area"?"la surface (longueur × profondeur)":"le volume (longueur × profondeur × hauteur)"}, à partir de la taille de référence.</p></>:<label className="field">Dimensions · longueur × profondeur × hauteur<Select value={sizeId} onValueChange={onSize}><SelectTrigger aria-label="Dimensions du produit"><Ruler size={17}/><SelectValue/></SelectTrigger><SelectContent>{product.sizes?.map(size=><SelectItem key={size.id} value={size.id}>{size.label} · {money(size.price)}</SelectItem>)}</SelectContent></Select></label>}
 {error&&<p className="form-error" role="alert">{error}</p>}<small>Le prix et la remise sont recalculés selon la dimension choisie.</small></div>;
}
