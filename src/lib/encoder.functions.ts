// Server functions exposing the auto-encoder worker to the browser.
// Helpers live in ./encoder.server so the split transform can't strip them.

import { createServerFn } from "@tanstack/react-start";
import {
  clearFinishedJobs,
  ensureEncoderWorker,
  getEncoderStatus,
  scanInbox,
  type EncoderStatus,
} from "./encoder.server";

export const encoderStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<EncoderStatus> => {
    ensureEncoderWorker();
    return getEncoderStatus();
  },
);

export const rescanInbox = createServerFn({ method: "POST" }).handler(
  async (): Promise<EncoderStatus> => {
    ensureEncoderWorker();
    try {
      await scanInbox();
    } catch {
      /* status will surface the error */
    }
    return getEncoderStatus();
  },
);

export const clearEncoderHistory = createServerFn({ method: "POST" }).handler(
  async (): Promise<EncoderStatus> => {
    clearFinishedJobs();
    return getEncoderStatus();
  },
);
