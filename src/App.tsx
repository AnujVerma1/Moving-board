import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isConfigured, supabase } from "./supabase";
import {
  type Board,
  type BoardMeta,
  createBoard,
  deleteBoard,
  getBoard,
  listBoards,
  renameBoard,
} from "./api";
import Auth from "./Auth";
import BoardEditor from "./BoardEditor";
import BoardsPanel from "./BoardsPanel";

const LAST_BOARD_KEY = "board:lastBoardId";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) {
    return (
      <div className="center-screen">
        <div className="card">
          <h1>Setup needed</h1>
          <p className="muted">
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in your Supabase URL and anon key,
            then restart <code>npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }
  if (session === undefined) return <div className="center-screen muted">Loading…</div>;
  if (!session) return <Auth />;
  return <Workspace userId={session.user.id} />;
}

function Workspace({ userId }: { userId: string }) {
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Load the board list; create a first board for brand-new users
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        let list = await listBoards();
        if (list.length === 0) list = [await createBoard("My first board")];
        setBoards(list);
        const last = readLastBoard();
        setCurrentId(list.some((b) => b.id === last) ? last : list[list.length - 1].id);
      } catch (e) {
        setError(errorText(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    setBoard(null);
    writeLastBoard(currentId);
    getBoard(currentId)
      .then((b) => !cancelled && setBoard(b))
      .catch((e) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  const handleCreate = async () => {
    try {
      const b = await createBoard(`Board ${boards.length + 1}`);
      setBoards((list) => [...list, b]);
      setCurrentId(b.id);
      setPanelOpen(false);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const handleRename = async (id: string, title: string) => {
    try {
      await renameBoard(id, title);
      setBoards((list) => list.map((b) => (b.id === id ? { ...b, title } : b)));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBoard(id, userId);
      let remaining = boards.filter((b) => b.id !== id);
      if (remaining.length === 0) remaining = [await createBoard("My first board")];
      setBoards(remaining);
      if (id === currentId) setCurrentId(remaining[remaining.length - 1].id);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <>
      {board ? (
        <BoardEditor
          key={board.id}
          board={board}
          userId={userId}
          onOpenBoards={() => setPanelOpen(true)}
          onNewBoard={handleCreate}
          onSignOut={() => supabase.auth.signOut()}
        />
      ) : (
        <div className="center-screen muted">{error ? "" : "Loading board…"}</div>
      )}

      {panelOpen && (
        <BoardsPanel
          boards={boards}
          currentId={currentId}
          onSelect={(id) => {
            setCurrentId(id);
            setPanelOpen(false);
          }}
          onCreate={handleCreate}
          onRename={handleRename}
          onDelete={handleDelete}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {error && (
        <div className="toast" onClick={() => setError(null)}>
          {error} <span className="muted">(click to dismiss)</span>
        </div>
      )}
    </>
  );
}

function errorText(e: unknown) {
  return e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
}

function readLastBoard() {
  try {
    return localStorage.getItem(LAST_BOARD_KEY);
  } catch {
    return null;
  }
}

function writeLastBoard(id: string) {
  try {
    localStorage.setItem(LAST_BOARD_KEY, id);
  } catch {
    // storage unavailable (private mode) — not critical
  }
}
