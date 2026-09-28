import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
export default async function PersonProfile({params}:{params:Promise<{userId:string}>}){
  const {userId}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(userId))notFound();
  const supabase=await createClient();
  const {data,error}=await supabase.from("profiles").select("username").eq("id",userId).maybeSingle();
  if(error||!data?.username)notFound();
  redirect("/u/"+encodeURIComponent(data.username));
}
