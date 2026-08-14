"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabase } from "@/utils/supabase/client";

type NotificationOpenButtonProps = {
  notificationId: string;
  actionUrl: string | null;
  isRead: boolean;
};

export function NotificationOpenButton({
  notificationId,
  actionUrl,
  isRead,
}: NotificationOpenButtonProps) {
  const router = useRouter();

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function openNotification() {
    setIsWorking(true);
    setErrorMessage("");

    try {
      if (!isRead) {
        const {
          error,
        } = await supabase.rpc(
          "mark_notification_read",
          {
            p_notification_id:
              notificationId,
          }
        );

        if (error) {
          throw error;
        }

        window.dispatchEvent(
          new Event("uin:notifications-changed")
        );
      }

      if (actionUrl) {
        router.push(
          actionUrl
        );
      } else {
        router.refresh();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Notification could not be opened."
      );
      setIsWorking(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={isWorking}
        onClick={openNotification}
        className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isWorking
          ? "Opening..."
          : actionUrl
            ? "Open"
            : isRead
              ? "Read"
              : "Mark as Read"}
      </button>

      {errorMessage && (
        <p className="mt-2 text-xs font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}


export function MarkAllNotificationsReadButton({
  disabled,
}: {
  disabled: boolean;
}) {
  const router = useRouter();

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function markAllRead() {
    setIsWorking(true);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "mark_all_notifications_read"
      );

      if (error) {
        throw error;
      }

      window.dispatchEvent(
        new Event("uin:notifications-changed")
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Notifications could not be updated."
      );
      setIsWorking(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={
          disabled ||
          isWorking
        }
        onClick={markAllRead}
        className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isWorking
          ? "Updating..."
          : "Mark All as Read"}
      </button>

      {errorMessage && (
        <p className="mt-2 text-xs font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
