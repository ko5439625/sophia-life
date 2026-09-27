import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string }>;

interface PanelProps {
  title: ReactNode;
  icon?: IconType;
  /** 오른쪽 위 보조 동작 (예: "+ 지출", "자세히") */
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** 데스크톱 대시보드 공용 카드 — 모노 톤, 얇은 테두리 */
export function Panel({ title, icon: Icon, action, className, bodyClassName, children }: PanelProps) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-border bg-card", className)}>
      <header className="flex min-h-[48px] items-center justify-between gap-2 border-b border-border px-4">
        <h3 className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-foreground">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="truncate">{title}</span>
        </h3>
        {action}
      </header>
      <div className={cn("flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** 패널 헤더용 작은 텍스트 버튼 */
export function PanelLink({ children, onClick, icon: Icon = ChevronRight }: { children: ReactNode; onClick?: () => void; icon?: IconType }) {
  return (
    <button
      onClick={onClick}
      className="-mr-2 inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/** 비어 있을 때 — 아이콘 + 한 줄 설명 + (선택) 행동 버튼 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon: IconType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-6 text-center", className)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-[240px] text-xs text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
