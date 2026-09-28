import { redirect } from "next/navigation";
export default async function SeedsPage({searchParams}:{searchParams:Promise<{alan?:string;gorunum?:string}>}){const params=await searchParams;redirect(params.alan==="sevdiklerim"||params.gorunum==="sevdiklerim"?"/timeline?tab=loved":params.alan==="deneyimler"?"/timeline?tab=experiences":"/timeline?tab=wanted");}
