"use client";

type DeleteCatalogueItemFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  catalogItemId: string;
  returnTo: string;
  personalRecordCount: number;
  compact?: boolean;
};

export default function DeleteCatalogueItemForm({
  action,
  catalogItemId,
  returnTo,
  personalRecordCount,
  compact = false,
}: DeleteCatalogueItemFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const message = personalRecordCount > 0
          ? `Bu ortak kayıt ve ona bağlı ${personalRecordCount} kişisel niyet/deneyim kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`
          : "Bu ortak kayıt kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?";
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="catalog_item_id" value={catalogItemId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button
        type="submit"
        className={`rounded-xl border border-red-300 bg-white text-sm font-black text-red-700 hover:bg-red-100 ${compact ? "px-4 py-2" : "px-5 py-3"}`}
      >
        {compact ? "Profil kayıtlarıyla birlikte tamamen sil" : "Tamamen sil"}
      </button>
    </form>
  );
}
