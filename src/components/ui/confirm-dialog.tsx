import { useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** 파괴적 동작(삭제 등)이면 확인 버튼을 빨간색으로. 기본 true */
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

// 전역 단일 호스트(<ConfirmDialogHost />)와 통신하는 간단한 모듈 스토어
let listener: ((p: PendingConfirm) => void) | null = null;

/** Promise 기반 확인 다이얼로그. 호스트가 없으면 window.confirm 으로 폴백. */
export function confirmDialog(options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!listener) {
      resolve(window.confirm(options.title ?? "삭제할까요?"));
      return;
    }
    listener({ ...options, resolve });
  });
}

/** const confirm = useConfirm(); if (!(await confirm({ title: "삭제할까요?" }))) return; */
export function useConfirm() {
  return useCallback((options?: ConfirmOptions) => confirmDialog(options), []);
}

/** App 루트에 한 번만 마운트 */
export function ConfirmDialogHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    const handler = (p: PendingConfirm) => {
      setPending((prev) => {
        // 이미 열린 다이얼로그가 있으면 이전 것은 취소 처리
        prev?.resolve(false);
        return p;
      });
    };
    listener = handler;
    return () => {
      if (listener === handler) listener = null;
    };
  }, []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const destructive = pending?.destructive ?? true;

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) close(false); }}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title ?? "삭제할까요?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.description ?? "삭제하면 되돌릴 수 없어요."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {pending?.cancelText ?? "취소"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={cn(destructive && buttonVariants({ variant: "destructive" }))}
          >
            {pending?.confirmText ?? "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
