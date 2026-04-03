"use client";

import { useEffect, useRef } from "react";
import {
  useCenterToast,
  type ToastKind,
} from "@/components/center-toast";

export type ServerFlashMessage = {
  kind: ToastKind;
  title: string;
  message?: string;
  timeoutMs?: number;
};

export function ServerFlashToast({ flash }: { flash: ServerFlashMessage | null }) {
  const { showToast } = useCenterToast();
  const consumedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!flash) {
      consumedKey.current = null;
      return;
    }
    const key = `${flash.kind}:${flash.title}:${flash.message ?? ""}`;
    if (consumedKey.current === key) return;
    consumedKey.current = key;
    const defaultMs = flash.kind === "error" ? 6500 : 4000;
    showToast({
      kind: flash.kind,
      title: flash.title,
      message: flash.message,
      timeoutMs: flash.timeoutMs ?? defaultMs,
    });
  }, [flash, showToast]);

  return null;
}

export function LoginFlashToasts({
  accountDeleted,
  passwordResetOk,
}: {
  accountDeleted?: boolean;
  passwordResetOk?: boolean;
}) {
  const { showToast } = useCenterToast();
  const deletedShown = useRef(false);
  const resetShown = useRef(false);

  useEffect(() => {
    if (accountDeleted && !deletedShown.current) {
      deletedShown.current = true;
      showToast({
        kind: "success",
        title: "Account deleted",
        message: "You can register again anytime.",
        timeoutMs: 5500,
      });
    }
  }, [accountDeleted, showToast]);

  useEffect(() => {
    if (passwordResetOk && !resetShown.current) {
      resetShown.current = true;
      showToast({
        kind: "info",
        title: "Password updated",
        message: "Sign in with your new password.",
        timeoutMs: 5500,
      });
    }
  }, [passwordResetOk, showToast]);

  return null;
}
