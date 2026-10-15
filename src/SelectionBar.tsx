import { CaptureUpdateAction, newElementWith } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, ExcalidrawImperativeAPI, UIAppState } from "@excalidraw/excalidraw/types";

type Props = {
  api: ExcalidrawImperativeAPI;
  appState: UIAppState;
};

type Patch = Record<string, unknown>;

const FILLABLE = new Set(["rectangle", "ellipse", "diamond"]);
const WIDTHS = [1, 2, 4];
const FONT_SIZES: [string, number][] = [
  ["S", 16],
  ["M", 20],
  ["L", 28],
  ["XL", 36],
];

/** Minimal, context-aware property controls for the current selection, shown in the top bar. */
export default function SelectionBar({ api, appState }: Props) {
  const all = api.getSceneElements();
  const selected = targets(all, appState);
  if (selected.length === 0) return null;

  const first = selected[0];
  const texts = selected.filter((el) => el.type === "text");
  const shapes = selected.filter((el) => el.type !== "text");
  const fillable = shapes.filter((el) => FILLABLE.has(el.type));

  const apply = (mutate: (el: ExcalidrawElement, byId: Map<string, ExcalidrawElement>) => Patch | null, appPatch: Partial<AppState>) => {
    const elements = api.getSceneElementsIncludingDeleted();
    const ids = new Set(targets(elements, api.getAppState()).map((el) => el.id));
    const byId = new Map(elements.map((el) => [el.id, el] as const));
    api.updateScene({
      elements: elements.map((el) => {
        if (!ids.has(el.id)) return el;
        const patch = mutate(el, byId);
        return patch ? newElementWith(el, patch as any) : el;
      }),
      appState: appPatch as AppState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const setColor = (strokeColor: string) => apply(() => ({ strokeColor }), { currentItemStrokeColor: strokeColor });

  const setFill = (backgroundColor: string) =>
    apply((el) => (FILLABLE.has(el.type) ? { backgroundColor, fillStyle: "solid" } : null), {
      currentItemBackgroundColor: backgroundColor,
      currentItemFillStyle: "solid",
    });

  const setWidth = (strokeWidth: number) =>
    apply((el) => (el.type === "text" ? null : { strokeWidth }), { currentItemStrokeWidth: strokeWidth });

  const setDashed = (dashed: boolean) => {
    const strokeStyle = dashed ? "dashed" : "solid";
    apply((el) => (el.type === "text" ? null : { strokeStyle }), { currentItemStrokeStyle: strokeStyle });
  };

  // Excalidraw doesn't expose text measuring, so scale the box with the font size and re-center it in its container
  const setFontSize = (fontSize: number) =>
    apply(
      (el, byId) => {
        if (el.type !== "text") return null;
        const ratio = fontSize / el.fontSize;
        const width = el.width * ratio;
        const height = el.height * ratio;
        const container = el.containerId ? byId.get(el.containerId) : undefined;
        if (!container) return { fontSize, width, height };
        return {
          fontSize,
          width,
          height,
          x: container.x + (container.width - width) / 2,
          y: container.y + (container.height - height) / 2,
        };
      },
      { currentItemFontSize: fontSize },
    );

  const remove = () => apply(() => ({ isDeleted: true }), { selectedElementIds: {} } as Partial<AppState>);

  const fontSize = texts[0]?.type === "text" ? texts[0].fontSize : undefined;
  const width = shapes[0]?.strokeWidth;
  const dashed = shapes[0]?.strokeStyle === "dashed";

  return (
    <div className="selection-bar">
      <label className="color-btn" title={texts.length && !shapes.length ? "Text color" : "Color"}>
        <span>{texts.length && !shapes.length ? "A" : "Color"}</span>
        <input type="color" value={toHex(first.strokeColor, "#1e1e1e")} onChange={(e) => setColor(e.target.value)} />
      </label>

      {fillable.length > 0 && (
        <div className="seg" title="Fill">
          <label className="seg-item color-seg">
            <span>Fill</span>
            <input
              type="color"
              value={toHex(fillable[0].backgroundColor, "#ffffff")}
              onChange={(e) => setFill(e.target.value)}
            />
          </label>
          <button
            className={`seg-item ${fillable[0].backgroundColor === "transparent" ? "on" : ""}`}
            title="No fill"
            onClick={() => setFill("transparent")}
          >
            ∅
          </button>
        </div>
      )}

      {shapes.length > 0 && (
        <>
          <div className="seg" title="Stroke width">
            {WIDTHS.map((w) => (
              <button key={w} className={`seg-item ${width === w ? "on" : ""}`} onClick={() => setWidth(w)}>
                <span className="line-sample" style={{ height: w + 1 }} />
              </button>
            ))}
          </div>
          <div className="seg" title="Line style">
            <button className={`seg-item ${!dashed ? "on" : ""}`} onClick={() => setDashed(false)}>
              <span className="line-sample" />
            </button>
            <button className={`seg-item ${dashed ? "on" : ""}`} onClick={() => setDashed(true)}>
              <span className="line-sample dashed" />
            </button>
          </div>
        </>
      )}

      {texts.length > 0 && (
        <div className="seg" title="Text size">
          {FONT_SIZES.map(([label, size]) => (
            <button key={size} className={`seg-item ${fontSize === size ? "on" : ""}`} onClick={() => setFontSize(size)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <button className="tb-btn" title="Delete (Del)" onClick={remove}>
        🗑
      </button>
    </div>
  );
}

/** Selected elements plus text bound inside selected shapes, plus text currently being typed. */
function targets(elements: readonly ExcalidrawElement[], appState: Pick<AppState, "selectedElementIds" | "editingTextElement">) {
  const ids = appState.selectedElementIds;
  const editingId = appState.editingTextElement?.id;
  return elements.filter(
    (el) =>
      !el.isDeleted &&
      (ids[el.id] || el.id === editingId || (el.type === "text" && el.containerId && ids[el.containerId])),
  );
}

// <input type="color"> only accepts #rrggbb
export function toHex(color: string | undefined, fallback: string) {
  if (!color) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return "#" + [...color.slice(1)].map((c) => c + c).join("");
  return fallback;
}
