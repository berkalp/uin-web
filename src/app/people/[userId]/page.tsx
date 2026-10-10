import { notFound, redirect } from "next/navigation";
import PageDataUnavailable from "@/components/common/PageDataUnavailable";
import { createClient } from "@/utils/supabase/server";
export default async function PersonProfile({params}:{params:Promise<{userId:string}>}){
  const {userId}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(userId))notFound();
  const retryHref=`/people/${encodeURIComponent(userId)}`;
  const supabase=await createClient();
  const {data,error}=await supabase.from("profiles").select("username").eq("id",userId).maybeSingle();
  if(error){console.error("Person profile redirect query failed:",error);return <PageDataUnavailable title="Profil şu anda yüklenemedi" retryHref={retryHref} backHref="/timeline" backLabel="Niyetlere dön"/>;}
  if(data===null)notFound();
  if(typeof data.username!=="string"||!data.username.trim()){console.error("Person profile redirect query returned an incomplete payload.");return <PageDataUnavailable title="Profil şu anda yüklenemedi" retryHref={retryHref} backHref="/timeline" backLabel="Niyetlere dön"/>;}
  redirect("/u/"+encodeURIComponent(data.username));
}
