import type { Location } from "@/types/location";

type LocationSelectProps = {
  locations: Location[];
  value: string;
  onChange: (value: string) => void;
};

export default function LocationSelect({
  locations,
  value,
  onChange,
}: LocationSelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
    >
      <option value="">District in Istanbul</option>

      {locations.map((location) => (
        <option key={location.id} value={location.id}>
          {location.district}
        </option>
      ))}
    </select>
  );
}