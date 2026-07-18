import type { ActivityCategory } from "@/types/activity";

type CategorySelectProps = {
  categories: ActivityCategory[];
  value: string;
  onChange: (value: string) => void;
};

export default function CategorySelect({
  categories,
  value,
  onChange,
}: CategorySelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
    >
      <option value="">Activity type</option>

      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}