import type { BoardMeta } from "./api";

type Props = {
  boards: BoardMeta[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export default function BoardsPanel({ boards, currentId, onSelect, onCreate, onRename, onDelete, onClose }: Props) {
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside className="panel">
        <header>
          <h2>Boards</h2>
          <button className="tb-btn" onClick={onClose} title="Close">✕</button>
        </header>
        <button className="btn primary full" onClick={onCreate}>+ New board</button>
        <ul>
          {boards.map((b) => (
            <li key={b.id} className={b.id === currentId ? "active" : ""}>
              <button className="board-name" onClick={() => onSelect(b.id)}>
                {b.title}
              </button>
              <button
                className="icon"
                title="Rename"
                onClick={() => {
                  const title = prompt("Rename board", b.title)?.trim();
                  if (title) onRename(b.id, title);
                }}
              >
                ✎
              </button>
              <button
                className="icon"
                title="Delete"
                onClick={() => {
                  if (confirm(`Delete "${b.title}"? This can't be undone.`)) onDelete(b.id);
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
