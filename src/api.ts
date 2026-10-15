import { getDataURL } from "@excalidraw/excalidraw";
import type { BinaryFileData } from "@excalidraw/excalidraw/types";
import { supabase } from "./supabase";

const BUCKET = "board-files";

export type SavedAppState = {
  viewBackgroundColor?: string;
  currentItemStrokeColor?: string;
};

export type BoardMeta = { id: string; title: string; created_at: string };

export type Board = BoardMeta & {
  // Excalidraw element JSON; kept loose so the DB layer doesn't depend on Excalidraw internals
  elements: any[];
  app_state: SavedAppState;
};

export async function listBoards(): Promise<BoardMeta[]> {
  const { data, error } = await supabase
    .from("boards")
    .select("id, title, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getBoard(id: string): Promise<Board> {
  const { data, error } = await supabase
    .from("boards")
    .select("id, title, created_at, elements, app_state")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createBoard(title: string): Promise<BoardMeta> {
  const { data, error } = await supabase
    .from("boards")
    .insert({ title })
    .select("id, title, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function saveBoard(
  id: string,
  elements: readonly unknown[],
  appState: SavedAppState,
) {
  const { error } = await supabase
    .from("boards")
    .update({ elements, app_state: appState, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function renameBoard(id: string, title: string) {
  const { error } = await supabase.from("boards").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function deleteBoard(id: string, userId: string) {
  // Remove the images this board references, then the board itself
  const board = await getBoard(id);
  const paths = imageFileIds(board.elements).map((f) => `${userId}/${f}`);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from("boards").delete().eq("id", id);
  if (error) throw error;
}

export function imageFileIds(elements: readonly any[]): string[] {
  const ids = new Set<string>();
  for (const el of elements) {
    if (el.type === "image" && el.fileId && !el.isDeleted) ids.add(el.fileId);
  }
  return [...ids];
}

export async function uploadFile(userId: string, file: BinaryFileData) {
  const blob = await (await fetch(file.dataURL)).blob();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${userId}/${file.id}`, blob, { contentType: file.mimeType, upsert: true });
  if (error) throw error;
}

export async function downloadFiles(userId: string, ids: string[]): Promise<BinaryFileData[]> {
  const results = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await supabase.storage.from(BUCKET).download(`${userId}/${id}`);
      if (error || !data) return null;
      return {
        id,
        mimeType: data.type || "image/png",
        dataURL: await getDataURL(data),
        created: Date.now(),
      } as BinaryFileData;
    }),
  );
  return results.filter((f): f is BinaryFileData => f !== null);
}
