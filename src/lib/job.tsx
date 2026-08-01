import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, type JobRun } from "./api";
import { Alert, Button, Progress } from "../ui";

/**
 * Polls a JobRun until it finishes, with pause/resume/cancel controls.
 * All real operations in the app are JobRuns now — this is the single
 * source of truth for progress, errors and results.
 */
export function useJob(jobId: string | null) {
  const [run, setRun] = useState<JobRun | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) return;
    try {
      const data = await apiFetch<JobRun>(`/jobs/runs/${jobId}`);
      setRun(data);
      if (data.status === "done" || data.status === "failed" || data.status === "cancelled") {
        if (timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      }
    } catch {
      // job may not exist yet; keep polling
    }
  }, [jobId]);

  useEffect(() => {
    setRun(null);
    if (!jobId) return;
    refresh();
    timer.current = setInterval(refresh, 1500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [jobId, refresh]);

  const pause = useCallback(async () => {
    if (!jobId) return;
    try {
      await apiFetch(`/jobs/runs/${jobId}/pause`, { method: "POST", body: JSON.stringify({}) });
      await refresh();
    } catch (err) {
      throw err;
    }
  }, [jobId, refresh]);

  const resume = useCallback(async () => {
    if (!jobId) return;
    try {
      await apiFetch(`/jobs/runs/${jobId}/resume`, { method: "POST", body: JSON.stringify({}) });
      await refresh();
    } catch (err) {
      throw err;
    }
  }, [jobId, refresh]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    try {
      await apiFetch(`/jobs/runs/${jobId}/cancel`, { method: "POST", body: JSON.stringify({}) });
      await refresh();
    } catch (err) {
      throw err;
    }
  }, [jobId, refresh]);

  return { run, loading, refresh, pause, resume, cancel };
}

export function JobProgressCard({ jobId, onDone }: { jobId: string | null; onDone?: (run: JobRun) => void }) {
  const { run, pause, resume, cancel } = useJob(jobId);
  const notified = useRef(false);

  useEffect(() => {
    if (run && (run.status === "done" || run.status === "failed" || run.status === "cancelled") && !notified.current) {
      notified.current = true;
      onDone?.(run);
    }
    if (run && run.status !== "done" && run.status !== "failed" && run.status !== "cancelled") {
      notified.current = false;
    }
  }, [run, onDone]);

  if (!run) {
    return <div className="card p-4 text-sm text-surface-500">⏳ جاري تجهيز المهمة...</div>;
  }

  const finished = run.status === "done" || run.status === "failed" || run.status === "cancelled";

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-surface-800">{run.label || run.kind}</div>
        <span className="chip bg-surface-100 text-surface-600 ring-1 ring-surface-200">
          {run.status === "queued" && "⏳ في الانتظار"}
          {run.status === "running" && "▶️ جارٍ التنفيذ"}
          {run.status === "paused" && "⏸️ متوقفة مؤقتاً"}
          {run.status === "done" && "✅ مكتملة"}
          {run.status === "failed" && "❌ فشلت"}
          {run.status === "cancelled" && "🚫 ملغاة"}
        </span>
      </div>
      <Progress value={run.progress} label={run.current_step || ""} sub={`${run.progress}%`} tone={run.status === "failed" ? "warn" : "brand"} />
      {!finished && (
        <div className="flex flex-wrap gap-2">
          {run.status !== "paused" && (
            <Button variant="warn" onClick={async () => { try { await pause(); } catch { /* toast handled by caller */ } }}>⏸️ إيقاف مؤقت</Button>
          )}
          {run.status === "paused" && (
            <Button variant="primary" onClick={async () => { try { await resume(); } catch { /* ignore */ } }}>▶️ استئناف</Button>
          )}
          <Button variant="danger" onClick={async () => { try { await cancel(); } catch { /* ignore */ } }}>⏹️ إلغاء</Button>
        </div>
      )}
      {run.error && (
        <Alert tone="danger" title="فشل التنفيذ">
          <p className="whitespace-pre-wrap text-xs">{run.error.split("\n")[0]}</p>
        </Alert>
      )}
    </div>
  );
}

/** Parse a JobRun result_json into an object. */
export function jobResult(run: JobRun | null): Record<string, any> | null {
  if (!run?.result_json) return null;
  try {
    return JSON.parse(run.result_json);
  } catch {
    return null;
  }
}
