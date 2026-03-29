"use client";

import { useEffect } from "react";

const recoveryKey = "printflow_action_recovery";

export function ErrorRecoveryReset() {
  useEffect(() => {
    window.sessionStorage.removeItem(recoveryKey);
  }, []);

  return null;
}
