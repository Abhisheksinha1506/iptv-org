"use client";

import type { ReactNode } from "react";

export interface SummaryCardProps {
  label: string;
  value: ReactNode;
  helperText?: string;
}

export function SummaryCard({ label, value, helperText }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900">{value}</p>
      {helperText ? <p className="mt-1 text-xs text-zinc-500">{helperText}</p> : null}
    </div>
  );
}

