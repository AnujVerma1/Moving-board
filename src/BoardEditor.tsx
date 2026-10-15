import { useCallback, useEffect, useRef, useState } from "react";
import {
  CaptureUpdateAction,
  Excalidraw,
  FONT_FAMILY,
  MainMenu,
  getSceneVersion,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  UIAppState,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import "@excalidraw/excalidraw/index.css";
import {
  type Board,
  downloadFiles,
  imageFileIds,
  saveBoard,
  uploadFile,
} from "./api";
import SelectionBar, { toHex } from "./SelectionBar";

type Status = "saved" | "unsaved" | "saving" | "error";

type Scene = {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

type Props = {
  board: Board;
  userId: string;
  onOpenBoards: () => void;
  onNewBoard: () => void;
  onSignOut: () => void;
};

const SAVE_DELAY_MS = 800;
const DEFAULT_BG = "#ffffff";
const DEFAULT_TEXT = "#1e1e1e";

export default function BoardEditor({ board, userId, onOpenBoards, onNewBoard, onSignOut }: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<Status>("saved");
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  const lastSavedKey = useRef(
    sceneKey(
      board.elements,
      board.app_state.viewBackgroundColor ?? DEFAULT_BG,
      board.app_state.currentItemStrokeColor ?? DEFAULT_TEXT,
    ),
  );
  const uploadedFiles = useRef(new Set<string>(imageFileIds(board.elements)));
  const saveTimer = useRef<number | undefined>(undefined);

  // Latest scene from onChange; saving from this snapshot also works while the editor is unmounting
  const latest = useRef<Scene | null>(null);

  const save = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    if (!latest.current) return;

    const { appState, files } = latest.current;
    const elements = latest.current.elements.filter((el) => !el.isDeleted);
    const key = sceneKey(elements, appState.viewBackgroundColor, appState.currentItemStrokeColor);
    if (key === lastSavedKey.current) {
      setStatus("saved");
      return;
    }

    setStatus("saving");
    try {
      // Upload any newly pasted images before saving the elements that point to them
      const newFiles = imageFileIds(elements).filter((id) => !uploadedFiles.current.has(id) && files[id]);
      for (const id of newFiles) {
        await uploadFile(userId, files[id]);
        uploadedFiles.current.add(id);
      }
      await saveBoard(board.id, elements, {
        viewBackgroundColor: appState.viewBackgroundColor,
        currentItemStrokeColor: appState.currentItemStrokeColor,
      });
      lastSavedKey.current = key;
      setStatus(saveTimer.current ? "unsaved" : "saved");
    } catch (err) {
      console.error("Save failed", err);
      setStatus("error");
    }
  }, [board.id, userId]);

  const handleChange = useCallback(
    (elements: Scene["elements"], appState: AppState, files: BinaryFiles) => {
      latest.current = { elements, appState, files };
      const key = sceneKey(elements, appState.viewBackgroundColor, appState.currentItemStrokeColor);
      if (key === lastSavedKey.current) return;
      setStatus("unsaved");
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(save, SAVE_DELAY_MS);
    },
    [save],
  );

  // Load images for this board once the editor is ready
  const handleApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      const ids = imageFileIds(board.elements);
      if (ids.length) downloadFiles(userId, ids).then((files) => api.addFiles(files));
    },
    [board.elements, userId],
  );

  // Flush pending changes when switching boards, and warn before closing the tab with unsaved work
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (saveTimer.current) {
        save();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      if (saveTimer.current) save();
    };
  }, [save]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const setBackground = (color: string) => {
    apiRef.current?.updateScene({
      appState: { viewBackgroundColor: color },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const setDefaultColor = (color: string) => {
    apiRef.current?.updateScene({
      appState: { currentItemStrokeColor: color },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const renderTopRightUI = (isMobile: boolean, appState: UIAppState) => {
    const hasSelection =
      Boolean(appState.editingTextElement) || Object.values(appState.selectedElementIds).some(Boolean);
    const compact = isMobile || hasSelection;
    return (
      <div className="toolbar">
        <span className={`status status-${status}`} title={statusLabel[status]}>
          {compact ? "" : statusLabel[status]}
        </span>
        {hasSelection && apiRef.current ? (
          <SelectionBar api={apiRef.current} appState={appState} />
        ) : (
          <>
            <label className="color-btn" title="Background color">
              <span>BG</span>
              <input
                type="color"
                value={toHex(appState.viewBackgroundColor, DEFAULT_BG)}
                onChange={(e) => setBackground(e.target.value)}
              />
            </label>
            <label className="color-btn" title="Color for new text and shapes">
              <span>A</span>
              <input
                type="color"
                value={toHex(appState.currentItemStrokeColor, DEFAULT_TEXT)}
                onChange={(e) => setDefaultColor(e.target.value)}
              />
            </label>
            <button className="tb-btn" onClick={toggleFullscreen} title="Toggle fullscreen">
              {isFullscreen ? "⤡" : "⛶"}
            </button>
          </>
        )}
        <button className="tb-btn" onClick={onOpenBoards} title="All boards">
          ☰ {compact ? "" : "Boards"}
        </button>
        <button className="tb-btn primary" onClick={onNewBoard} title="New board">
          + {compact ? "" : "New"}
        </button>
      </div>
    );
  };

  return (
    <div className="editor">
      <Excalidraw
        excalidrawAPI={handleApi}
        initialData={{
          elements: board.elements,
          appState: {
            viewBackgroundColor: board.app_state.viewBackgroundColor ?? DEFAULT_BG,
            currentItemStrokeColor: board.app_state.currentItemStrokeColor ?? DEFAULT_TEXT,
            // Clean (non hand-drawn) look by default
            currentItemRoughness: 0,
            currentItemFontFamily: FONT_FAMILY.Nunito,
          },
          scrollToContent: true,
        }}
        name={board.title}
        onChange={handleChange}
        renderTopRightUI={renderTopRightUI}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      >
        <MainMenu>
          <MainMenu.Item onSelect={onOpenBoards}>All boards</MainMenu.Item>
          <MainMenu.Item onSelect={onNewBoard}>New board</MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.DefaultItems.Help />
          <MainMenu.Separator />
          <MainMenu.Item onSelect={onSignOut}>Sign out</MainMenu.Item>
        </MainMenu>
      </Excalidraw>
    </div>
  );
}

const statusLabel: Record<Status, string> = {
  saved: "Saved",
  unsaved: "Unsaved",
  saving: "Saving…",
  error: "Save failed",
};

// Cheap fingerprint of what we persist, used to skip no-op saves (onChange fires on every pointer move)
function sceneKey(elements: readonly any[], bg?: string, text?: string) {
  const live = elements.filter((el) => !el.isDeleted);
  return `${live.length}|${getSceneVersion(live)}|${bg ?? ""}|${text ?? ""}`;
}
