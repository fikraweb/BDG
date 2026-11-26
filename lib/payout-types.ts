export type PayoutMethod = "cashplus" | "wafacash";
export const payoutName=(method:PayoutMethod)=>method==="cashplus"?"Cash Plus":"Wafacash";
export type PayoutRequest={orderId:string;createdAt:number;name:string;email:string;phone:string;devisReference:string;maitreOuvrage:string;amount:number;discount:number;method:PayoutMethod|null;status:"awaiting_transfer"|"pending"|"sent"|"failed";code?:string;sentAt?:number;eventId?:string;updatedAt?:number};
