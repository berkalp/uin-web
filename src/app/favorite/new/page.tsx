import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AddFavoriteWeb from "@/components/preferences/AddFavoriteWeb";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Sevdiğin bir şey ekle | UIN",
};

export default async function AddFavoritePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <AddFavoriteWeb />
      </div>
    </main>
  );
}
