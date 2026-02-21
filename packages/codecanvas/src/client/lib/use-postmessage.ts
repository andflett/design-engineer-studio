import { useEffect, useRef, useCallback, type RefObject } from "react";
import type { EditorToIframe, IframeToEditor } from "../../shared/protocol.js";
import { sendToIframe, onIframeMessage } from "./iframe-bridge.js";

/**
 * React hook for postMessage communication with the target app iframe.
 * Uses a ref for the callback to avoid re-subscribing on every render.
 */
export function usePostMessage(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  onMessage: (msg: IframeToEditor) => void
) {
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    return onIframeMessage((msg) => {
      callbackRef.current(msg);
    });
  }, []);

  const send = useCallback(
    (msg: EditorToIframe) => {
      if (iframeRef.current) {
        sendToIframe(iframeRef.current, msg);
      }
    },
    [iframeRef]
  );

  return { send };
}
