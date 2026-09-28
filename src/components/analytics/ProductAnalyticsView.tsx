"use client";

import { useEffect } from "react";
import { trackProductEvent } from "@/utils/productAnalytics";

export default function ProductAnalyticsView({ targetId, contentType }: { targetId: string; contentType?: string | null }) {
  useEffect(() => {
    void trackProductEvent("common_card_viewed", {
      targetId,
      contentType: contentType || undefined,
      source: "common_card_detail",
    });
  }, [contentType, targetId]);

  return null;
}
