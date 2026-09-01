import { FileDown, FileSpreadsheet } from "lucide-react";

type ReportExportButtonsProps = {
  kind: "sales" | "quotes";
  period: "day" | "month";
  refValue: string;
};

export function ReportExportButtons({ kind, period, refValue }: ReportExportButtonsProps) {
  const base = new URLSearchParams({ kind, period, ref: refValue });
  const href = (format: "pdf" | "xlsx") => {
    const params = new URLSearchParams(base);
    params.set("format", format);
    return `/api/admin/reports/commercial?${params.toString()}`;
  };

  return (
    <div className="inline-flex items-center gap-2" aria-label="Exportar reporte">
      <a
        href={href("pdf")}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-2 text-sm font-bold text-ink-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
      >
        <FileDown className="size-4" /> PDF
      </a>
      <a
        href={href("xlsx")}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-2 text-sm font-bold text-ink-700 shadow-sm transition hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700"
      >
        <FileSpreadsheet className="size-4" /> Excel
      </a>
    </div>
  );
}
