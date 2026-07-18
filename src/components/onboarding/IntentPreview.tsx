type IntentPreviewProps = {
  preview: string;
};

export default function IntentPreview({ preview }: IntentPreviewProps) {
  return (
    <div className="mt-8 rounded-2xl bg-gray-50 p-5">
      <p className="text-sm font-semibold text-gray-500">
        Your Intent
      </p>

      <p className="mt-2 text-gray-900 leading-7">
        {preview}
      </p>
    </div>
  );
}