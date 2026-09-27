import { useState } from "react";
import { ChevronRight, Landmark } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import PensionView from "../investment/PensionView";
import { useFinancial } from "@/store/financialStore";
import { cn } from "@/lib/utils";

/** 기존 연금 화면(PensionView)을 대화상자로 — 입력은 여기서 계속 가능 */
export function PensionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <div className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            연금 상세
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs">IRP · 연금저축 · DC 계좌 — 인출 전까지는 비가용 자산이에요</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{open && <PensionView />}</div>
      </DialogContent>
    </Dialog>
  );
}

/** "연금 잔액 ₩… · 상세" 한 줄 — 자산 요약/자산 현황에서 공용 */
export function PensionLine({ className, format }: { className?: string; format: (n: number) => string }) {
  const { totalPension } = useFinancial();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={cn("flex min-h-[40px] items-center gap-2 text-[13px]", className)}>
        <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">연금 잔액</span>
        <span className="font-mono font-semibold tabular-nums text-foreground">{format(totalPension)}</span>
        <button
          onClick={() => setOpen(true)}
          className="ml-auto inline-flex min-h-[36px] items-center gap-0.5 rounded-lg px-2 -mr-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          상세
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <PensionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
