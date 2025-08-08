import { useRef, useState } from "react";

type CornerFlags = { tl: boolean; tr: boolean; bl: boolean; br: boolean };
type Pill = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  corners: CornerFlags;
};

const MIN_PILL = 40;
const MIN_SPLIT = 20;
const PILL_R = 20;

let idCounter = 0;
const nextId = () => "pill_" + ++idCounter;

const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

function randomColor() {
  const h = Math.floor(Math.random() * 360);
  const s = 55 + Math.floor(Math.random() * 30);
  return `hsl(${h} ${s}% 50%)`;
}

const cornerCss = (c: CornerFlags) =>
  `${c.tl ? PILL_R : 0}px ${c.tr ? PILL_R : 0}px ${c.br ? PILL_R : 0}px ${
    c.bl ? PILL_R : 0
  }px`;

export default function App() {
  const boardRef = useRef<HTMLDivElement | null>(null);

  const [pills, setPills] = useState<Pill[]>([]);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  const [drawStart, setDrawStart] = useState<
    | undefined
    | {
        x: number;
        y: number;
        color: string;
      }
  >();

  const [preview, setPreview] = useState<
    | undefined
    | {
        x: number;
        y: number;
        width: number;
        height: number;
        color: string;
      }
  >();

  const [drag, setDrag] = useState<
    | undefined
    | {
        id: string;
        offsetX: number;
        offsetY: number;
        moved: boolean;
      }
  >();

  const updateCursor = (clientX: number, clientY: number) => {
    const el = boardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCursor({
      x: clamp(clientX - r.left, 0, r.width),
      y: clamp(clientY - r.top, 0, r.height),
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!boardRef.current) return;
    boardRef.current.setPointerCapture(e.pointerId);
    updateCursor(e.clientX, e.clientY);

    const id = (e.target as HTMLElement).dataset.pillPartId;
    if (id) {
      const pill = pills.find((p) => p.id === id);
      if (!pill) return;
      const r = boardRef.current.getBoundingClientRect();
      setDrag({
        id,
        offsetX: e.clientX - r.left - pill.x,
        offsetY: e.clientY - r.top - pill.y,
        moved: false,
      });
      return;
    }

    setDrawStart({ x: cursor.x, y: cursor.y, color: randomColor() });
    setPreview(undefined);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    updateCursor(e.clientX, e.clientY);
    const el = boardRef.current;
    if (!el) return;
    const bounds = el.getBoundingClientRect();

    if (drawStart) {
      const dx = cursor.x - drawStart.x;
      const dy = cursor.y - drawStart.y;
      const meetsMinPillSize =
        Math.abs(dx) >= MIN_PILL || Math.abs(dy) >= MIN_PILL;
      if (meetsMinPillSize || preview) {
        let w = Math.abs(dx);
        let h = Math.abs(dy);
        if (w < MIN_PILL) w = MIN_PILL;
        if (h < MIN_PILL) h = MIN_PILL;
        const x = clamp(Math.min(drawStart.x, cursor.x), 0, bounds.width - w);
        const y = clamp(Math.min(drawStart.y, cursor.y), 0, bounds.height - h);
        setPreview({
          x,
          y,
          width: w,
          height: h,
          color: drawStart.color,
        });
      }
      return;
    }

    if (drag) {
      setPills((prev) => {
        const idx = prev.findIndex((p) => p.id === drag.id);
        if (idx === -1) return prev;
        const copy = [...prev];
        const pill = copy[idx];
        const nx = clamp(cursor.x - drag.offsetX, 0, bounds.width - pill.width);
        const ny = clamp(
          cursor.y - drag.offsetY,
          0,
          bounds.height - pill.height
        );
        if (Math.abs(nx - pill.x) > 0.5 || Math.abs(ny - pill.y) > 0.5) {
          setDrag((d) => (d ? { ...d, moved: true } : d));
        }
        copy[idx] = { ...pill, x: nx, y: ny };
        return copy;
      });
    }
  };

  const onPointerUp = () => {
    if (preview && drawStart) {
      setPills((prev) => [
        ...prev,
        {
          id: nextId(),
          x: preview.x,
          y: preview.y,
          width: preview.width,
          height: preview.height,
          color: preview.color,
          corners: { tl: true, tr: true, bl: true, br: true },
        },
      ]);
    } else if (!drag || !drag.moved) {
      splitPillAt(cursor.x, cursor.y);
    }
    setDrawStart(undefined);
    setPreview(undefined);
    setDrag(undefined);
  };

  const makePiece = (
    base: Pill,
    x: number,
    y: number,
    w: number,
    h: number,
    corners: CornerFlags
  ): Pill => ({
    id: nextId(),
    x,
    y,
    width: w,
    height: h,
    color: base.color,
    corners,
  });

  const splitPillAt = (px: number, py: number) => {
    setPills((prev) => {
      const out: Pill[] = [];
      for (const pill of prev) {
        const insideX = px > pill.x && px < pill.x + pill.width;
        const insideY = py > pill.y && py < pill.y + pill.height;
        const canX = insideX && pill.width >= 2 * MIN_SPLIT;
        const canY = insideY && pill.height >= 2 * MIN_SPLIT;

        let splitX = -1;
        if (canX) {
          splitX = clamp(
            px,
            pill.x + MIN_SPLIT,
            pill.x + pill.width - MIN_SPLIT
          );
        }
        let splitY = -1;
        if (canY) {
          splitY = clamp(
            py,
            pill.y + MIN_SPLIT,
            pill.y + pill.height - MIN_SPLIT
          );
        }

        const doX = splitX !== -1;
        const doY = splitY !== -1;

        if (doX && doY) {
          const leftW = splitX - pill.x;
          const rightW = pill.x + pill.width - splitX;
          const topH = splitY - pill.y;
          const bottomH = pill.y + pill.height - splitY;
          out.push(
            makePiece(pill, pill.x, pill.y, leftW, topH, {
              tl: pill.corners.tl,
              tr: false,
              bl: false,
              br: false,
            }),
            makePiece(pill, splitX, pill.y, rightW, topH, {
              tl: false,
              tr: pill.corners.tr,
              bl: false,
              br: false,
            }),
            makePiece(pill, pill.x, splitY, leftW, bottomH, {
              tl: false,
              tr: false,
              bl: pill.corners.bl,
              br: false,
            }),
            makePiece(pill, splitX, splitY, rightW, bottomH, {
              tl: false,
              tr: false,
              bl: false,
              br: pill.corners.br,
            })
          );
          continue;
        }

        if (doX) {
          const leftW = splitX - pill.x;
          const rightW = pill.x + pill.width - splitX;
          out.push(
            makePiece(pill, pill.x, pill.y, leftW, pill.height, {
              tl: pill.corners.tl,
              tr: false,
              bl: pill.corners.bl,
              br: false,
            }),
            makePiece(pill, splitX, pill.y, rightW, pill.height, {
              tl: false,
              tr: pill.corners.tr,
              bl: false,
              br: pill.corners.br,
            })
          );
          continue;
        }

        if (doY) {
          const topH = splitY - pill.y;
          const bottomH = pill.y + pill.height - splitY;
          out.push(
            makePiece(pill, pill.x, pill.y, pill.width, topH, {
              tl: pill.corners.tl,
              tr: pill.corners.tr,
              bl: false,
              br: false,
            }),
            makePiece(pill, pill.x, splitY, pill.width, bottomH, {
              tl: false,
              tr: false,
              bl: pill.corners.bl,
              br: pill.corners.br,
            })
          );
          continue;
        }

        if (insideX && !doX) {
          pill.x =
            px < pill.x + pill.width / 2
              ? Math.max(0, px - pill.width - 2)
              : px + 2;
        }
        if (insideY && !doY) {
          pill.y =
            py < pill.y + pill.height / 2
              ? Math.max(0, py - pill.height - 2)
              : py + 2;
        }
        out.push(pill);
      }
      return out;
    });
  };

  return (
    <div
      ref={boardRef}
      className="relative w-screen h-screen overflow-hidden bg-sky-100 text-slate-800 select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ cursor: drag ? "grabbing" : "move" }}
    >
      <div
        className="pointer-events-none absolute top-0 bottom-0 z-50 bg-black"
        style={{ left: cursor.x, width: 3 }}
      />
      <div
        className="pointer-events-none absolute left-0 right-0 z-50 bg-black"
        style={{ top: cursor.y, height: 3 }}
      />
      {pills.map((p) => (
        <div
          key={p.id}
          data-pill-part-id={p.id}
          className="absolute border-2 border-black/50 shadow-sm cursor-grab active:cursor-grabbing z-10"
          style={{
            left: p.x,
            top: p.y,
            width: p.width,
            height: p.height,
            background: p.color.replace(/\)$/, " / 0.7)"),
            borderRadius: cornerCss(p.corners),
          }}
        />
      ))}
      {preview && (
        <div
          className="absolute pointer-events-none border-2 border-dashed border-blue-500/70 bg-blue-400/20 z-40"
          style={{
            left: preview.x,
            top: preview.y,
            width: preview.width,
            height: preview.height,
            borderRadius: PILL_R,
          }}
        />
      )}
    </div>
  );
}
