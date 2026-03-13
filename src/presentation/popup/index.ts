export type {
  CredentialBookmark,
  ModelBookmarks,
  BookmarkStore,
} from "../../application/types/index.js";

export enum ThemeChoice {
  LIGHT = "light",
  DARK = "dark",
  SYSTEM = "system",
}

export enum ContentPageMessageAction {
  SHOW_OVERLAY = "showOverlay",
  HIDE_OVERLAY = "hideOverlay",
  TOGGLE_OVERLAY = "toggleOverlay",
  FILL_LOGIN_FIELDS = "fillLoginFields",
}

export type ContentPageMessage = {
  action: ContentPageMessageAction;
  credentials?: { username: string; password: string };
};
