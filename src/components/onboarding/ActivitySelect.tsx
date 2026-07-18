import type { Activity } from "@/types/activity";

type ActivitySelectProps = {
  activities: Activity[];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

export default function ActivitySelect({
  activities,
  value,
  disabled,
  onChange,
}: ActivitySelectProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-400"
    >
      <option value="">Activity</option>

      {activities.map((activity) => (
        <option key={activity.id} value={activity.id}>
          {activity.name}
        </option>
      ))}
    </select>
  );
}