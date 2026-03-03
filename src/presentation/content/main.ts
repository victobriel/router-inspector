import { CollectionService } from "../../application/CollectionService.js";
import { ContentPageUseCase } from "../../application/ContentPageUseCase.js";
import { CollectMessageSchema } from "../../domain/schemas/validation.js";
import { ZodError } from "zod";

chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
  const result = CollectMessageSchema.safeParse(rawMessage);

  if (!result.success) {
    return false;
  }

  CollectionService.handleCollect(result.data)
    .then(sendResponse)
    .catch((error) => {
      if (error instanceof ZodError) {
        const message = error.issues.map((issue) => issue.message).join("; ");
        sendResponse({ success: false, message });
        return;
      }

      sendResponse({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    });

  return true;
});

window.addEventListener("load", () => {
  void ContentPageUseCase.bootstrap();
});
