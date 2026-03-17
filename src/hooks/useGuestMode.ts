import { useMemo } from "react";

/**
 * Guest mode hook
 * - PIN "0000" 으로 진입하면 게스트 모드
 * - 금액/개인정보는 마스킹
 * - 분석/차트/구조는 정상 표시
 */
export function useGuestMode() {
  const isGuest = useMemo(
    () => sessionStorage.getItem("sophia-guest") === "true",
    []
  );

  /**
   * 금액 마스킹: 게스트면 "₩•••••••" 반환
   * @param amount 원본 금액 문자열 또는 숫자
   * @param prefix 접두사 (기본: "")
   */
  const maskAmount = (amount: string | number, prefix = ""): string => {
    if (!isGuest) {
      return typeof amount === "number"
        ? `${prefix}${new Intl.NumberFormat("ko-KR").format(amount)}`
        : `${prefix}${amount}`;
    }
    return `${prefix}₩•••••••`;
  };

  /**
   * 숫자만 마스킹: 게스트면 "•••" 반환
   */
  const maskNumber = (value: string | number): string => {
    if (!isGuest) return String(value);
    return "•••";
  };

  /**
   * 텍스트 마스킹: 게스트면 "••••••" 반환
   */
  const maskText = (text: string): string => {
    if (!isGuest) return text;
    return "••••••";
  };

  /**
   * 퍼센트는 마스킹 안 함 (분석용)
   */
  const maskPercent = (value: string | number): string => {
    return String(value); // 퍼센트는 항상 표시
  };

  return { isGuest, maskAmount, maskNumber, maskText, maskPercent };
}
