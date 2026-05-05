"use client";

import { useEffect, useState } from "react";
import { PerformanceForm } from "@/components/PerformanceForm";
import type { PerformanceMetricWithQueue } from "@/types";

export default function EditPerformancePage({
  params,
}: {
  params: { id: string };
}) {
  const [metric,   setMetric]   = useState<PerformanceMetricWithQueue | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/performance/${params.id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setMetric(data);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">読み込み中...</div>;
  }
  if (notFound || !metric) {
    return (
      <div className="text-red-500 py-12 text-center">
        実績データが見つかりません
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">実績編集</h2>
        <p className="text-sm text-gray-500 mt-1">ID: {metric.id}</p>
      </div>
      <PerformanceForm mode="edit" initial={metric} />
    </div>
  );
}
