import { useState, useCallback, useRef, useEffect } from "react";
import { Tooltip } from "../tooltip.js";
import { Plus, Minus } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GridConfig {
  columns: string[]; // e.g. ["1fr", "1fr", "1fr"]
  rows: string[]; // e.g. ["1fr", "1fr"]
  gap: string; // e.g. "8px"
}

export interface GridChildPlacement {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
}

interface GridInputProps {
  /** Current grid config from authored styles (Tailwind classes or CSS rules), falls back to defaults */
  config?: Partial<GridConfig>;
  /** Child placements to visualize in the mini-grid */
  children?: Array<{ label: string; placement: GridChildPlacement }>;
  /** Selected child index (for highlighting) */
  selectedChild?: number;
  /** Called when column/row count or sizing changes */
  onConfigChange: (config: GridConfig) => void;
  /** Called when a child placement changes (drag to resize span) */
  onChildPlacementChange?: (index: number, placement: GridChildPlacement) => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: GridConfig = {
  columns: ["1fr", "1fr", "1fr"],
  rows: ["1fr", "1fr"],
  gap: "8px",
};

function resolveConfig(partial?: Partial<GridConfig>): GridConfig {
  return {
    columns: partial?.columns?.length ? partial.columns : DEFAULT_CONFIG.columns,
    rows: partial?.rows?.length ? partial.rows : DEFAULT_CONFIG.rows,
    gap: partial?.gap || DEFAULT_CONFIG.gap,
  };
}

// ---------------------------------------------------------------------------
// Track size editor (inline editable)
// ---------------------------------------------------------------------------

function TrackSizeCell({
  value,
  onChange,
  orientation,
}: {
  value: string;
  onChange: (v: string) => void;
  orientation: "col" | "row";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="studio-grid-track-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() && draft.trim() !== value) onChange(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            if (draft.trim() && draft.trim() !== value) onChange(draft.trim());
          }
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(value);
          }
        }}
      />
    );
  }

  return (
    <Tooltip content={`${orientation === "col" ? "Column" : "Row"} size — click to edit`} side="top">
      <button
        className="studio-grid-track-label"
        onClick={() => setEditing(true)}
      >
        {value}
      </button>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Mini grid visual
// ---------------------------------------------------------------------------

function MiniGrid({
  config,
  children,
  selectedChild,
  onCellClick,
  drawState,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
}: {
  config: GridConfig;
  children?: Array<{ label: string; placement: GridChildPlacement }>;
  selectedChild?: number;
  onCellClick?: (row: number, col: number) => void;
  drawState: { drawing: boolean; startRow: number; startCol: number; endRow: number; endCol: number } | null;
  onDrawStart: (row: number, col: number) => void;
  onDrawMove: (row: number, col: number) => void;
  onDrawEnd: () => void;
}) {
  const numCols = config.columns.length;
  const numRows = config.rows.length;

  // Build cell occupancy map from children
  const occupancy = new Map<string, { index: number; label: string }>();
  children?.forEach((child, i) => {
    for (let r = child.placement.rowStart; r < child.placement.rowEnd; r++) {
      for (let c = child.placement.colStart; c < child.placement.colEnd; c++) {
        occupancy.set(`${r}-${c}`, { index: i, label: child.label });
      }
    }
  });

  // Draw selection bounds
  const drawMin = drawState
    ? {
        row: Math.min(drawState.startRow, drawState.endRow),
        col: Math.min(drawState.startCol, drawState.endCol),
      }
    : null;
  const drawMax = drawState
    ? {
        row: Math.max(drawState.startRow, drawState.endRow),
        col: Math.max(drawState.startCol, drawState.endCol),
      }
    : null;

  function isInDrawRegion(row: number, col: number) {
    if (!drawMin || !drawMax) return false;
    return row >= drawMin.row && row <= drawMax.row && col >= drawMin.col && col <= drawMax.col;
  }

  // Render the origin cell for each child (first cell of its placement)
  const renderedChildren = new Set<number>();

  return (
    <div
      className="studio-grid-mini"
      style={{
        display: "grid",
        gridTemplateColumns: config.columns.join(" "),
        gridTemplateRows: config.rows.map(() => "1fr").join(" "),
        gap: "1px",
      }}
      onPointerLeave={() => {
        if (drawState?.drawing) onDrawEnd();
      }}
    >
      {Array.from({ length: numRows }, (_, row) =>
        Array.from({ length: numCols }, (_, col) => {
          const key = `${row}-${col}`;
          const occ = occupancy.get(key);
          const inDraw = isInDrawRegion(row, col);
          const isSelected = occ && occ.index === selectedChild;

          // If this cell belongs to a child, check if it's the origin
          if (occ && !renderedChildren.has(occ.index)) {
            renderedChildren.add(occ.index);
            const child = children![occ.index];
            const p = child.placement;
            return (
              <div
                key={key}
                className={`studio-grid-cell studio-grid-cell--child ${isSelected ? "studio-grid-cell--selected" : ""}`}
                style={{
                  gridColumn: `${p.colStart + 1} / ${p.colEnd + 1}`,
                  gridRow: `${p.rowStart + 1} / ${p.rowEnd + 1}`,
                }}
              >
                <span className="studio-grid-cell-label">{child.label}</span>
              </div>
            );
          }

          // Skip non-origin cells of children
          if (occ) return null;

          return (
            <div
              key={key}
              className={`studio-grid-cell ${inDraw ? "studio-grid-cell--drawing" : ""}`}
              onPointerDown={(e) => {
                e.preventDefault();
                onDrawStart(row, col);
              }}
              onPointerEnter={() => {
                if (drawState?.drawing) onDrawMove(row, col);
              }}
              onPointerUp={() => {
                if (drawState?.drawing) onDrawEnd();
              }}
              onClick={() => onCellClick?.(row, col)}
            />
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main GridInput component
// ---------------------------------------------------------------------------

export function GridInput({
  config: configProp,
  children,
  selectedChild,
  onConfigChange,
  onChildPlacementChange,
}: GridInputProps) {
  const config = resolveConfig(configProp);
  const [drawState, setDrawState] = useState<{
    drawing: boolean;
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null>(null);

  const numCols = config.columns.length;
  const numRows = config.rows.length;

  // --- Column/row add/remove ---
  const addColumn = useCallback(() => {
    onConfigChange({
      ...config,
      columns: [...config.columns, "1fr"],
    });
  }, [config, onConfigChange]);

  const removeColumn = useCallback(() => {
    if (numCols <= 1) return;
    onConfigChange({
      ...config,
      columns: config.columns.slice(0, -1),
    });
  }, [config, numCols, onConfigChange]);

  const addRow = useCallback(() => {
    onConfigChange({
      ...config,
      rows: [...config.rows, "1fr"],
    });
  }, [config, onConfigChange]);

  const removeRow = useCallback(() => {
    if (numRows <= 1) return;
    onConfigChange({
      ...config,
      rows: config.rows.slice(0, -1),
    });
  }, [config, numRows, onConfigChange]);

  // --- Track sizing ---
  const setColumnSize = useCallback(
    (index: number, value: string) => {
      const next = [...config.columns];
      next[index] = value;
      onConfigChange({ ...config, columns: next });
    },
    [config, onConfigChange]
  );

  const setRowSize = useCallback(
    (index: number, value: string) => {
      const next = [...config.rows];
      next[index] = value;
      onConfigChange({ ...config, rows: next });
    },
    [config, onConfigChange]
  );

  // --- Draw to place child ---
  const handleDrawStart = useCallback((row: number, col: number) => {
    setDrawState({ drawing: true, startRow: row, startCol: col, endRow: row, endCol: col });
  }, []);

  const handleDrawMove = useCallback((row: number, col: number) => {
    setDrawState((prev) => (prev ? { ...prev, endRow: row, endCol: col } : prev));
  }, []);

  const handleDrawEnd = useCallback(() => {
    if (!drawState) return;
    const placement: GridChildPlacement = {
      colStart: Math.min(drawState.startCol, drawState.endCol),
      colEnd: Math.max(drawState.startCol, drawState.endCol) + 1,
      rowStart: Math.min(drawState.startRow, drawState.endRow),
      rowEnd: Math.max(drawState.startRow, drawState.endRow) + 1,
    };
    // If there's a selected child, update its placement
    if (selectedChild !== undefined && onChildPlacementChange) {
      onChildPlacementChange(selectedChild, placement);
    }
    setDrawState(null);
  }, [drawState, selectedChild, onChildPlacementChange]);

  // --- Generated CSS preview ---
  const cssPreview = [
    `grid-template-columns: ${config.columns.join(" ")};`,
    `grid-template-rows: ${config.rows.join(" ")};`,
    config.gap !== "0" && config.gap !== "0px" ? `gap: ${config.gap};` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="studio-grid-input">
      {/* Column size labels */}
      <div className="studio-grid-col-labels">
        <div className="studio-grid-corner" />
        {config.columns.map((size, i) => (
          <TrackSizeCell
            key={`col-${i}`}
            value={size}
            onChange={(v) => setColumnSize(i, v)}
            orientation="col"
          />
        ))}
      </div>

      <div className="studio-grid-body">
        {/* Row size labels */}
        <div className="studio-grid-row-labels">
          {config.rows.map((size, i) => (
            <TrackSizeCell
              key={`row-${i}`}
              value={size}
              onChange={(v) => setRowSize(i, v)}
              orientation="row"
            />
          ))}
        </div>

        {/* The visual grid */}
        <MiniGrid
          config={config}
          children={children}
          selectedChild={selectedChild}
          drawState={drawState}
          onDrawStart={handleDrawStart}
          onDrawMove={handleDrawMove}
          onDrawEnd={handleDrawEnd}
        />
      </div>

      {/* Column/Row controls */}
      <div className="studio-grid-controls">
        <div className="studio-grid-control-group">
          <span className="studio-grid-control-label">Cols</span>
          <Tooltip content="Remove column" side="bottom">
            <button className="studio-icon-btn" onClick={removeColumn} disabled={numCols <= 1}>
              <Minus size={12} />
            </button>
          </Tooltip>
          <span className="studio-grid-count">{numCols}</span>
          <Tooltip content="Add column" side="bottom">
            <button className="studio-icon-btn" onClick={addColumn}>
              <Plus size={12} />
            </button>
          </Tooltip>
        </div>
        <div className="studio-grid-control-group">
          <span className="studio-grid-control-label">Rows</span>
          <Tooltip content="Remove row" side="bottom">
            <button className="studio-icon-btn" onClick={removeRow} disabled={numRows <= 1}>
              <Minus size={12} />
            </button>
          </Tooltip>
          <span className="studio-grid-count">{numRows}</span>
          <Tooltip content="Add row" side="bottom">
            <button className="studio-icon-btn" onClick={addRow}>
              <Plus size={12} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* CSS output preview */}
      <div className="studio-grid-css-preview">
        <pre>{cssPreview}</pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo wrapper — shows Display segmented + grid input together
// ---------------------------------------------------------------------------

export function GridInputDemo() {
  const [display, setDisplay] = useState<string>("grid");
  const [config, setConfig] = useState<GridConfig>({
    columns: ["1fr", "2fr", "1fr"],
    rows: ["auto", "1fr", "auto"],
    gap: "8px",
  });

  const [childPlacements, setChildPlacements] = useState<
    Array<{ label: string; placement: GridChildPlacement }>
  >([
    { label: "Header", placement: { colStart: 0, colEnd: 3, rowStart: 0, rowEnd: 1 } },
    { label: "Sidebar", placement: { colStart: 0, colEnd: 1, rowStart: 1, rowEnd: 2 } },
    { label: "Main", placement: { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 } },
    { label: "Footer", placement: { colStart: 0, colEnd: 3, rowStart: 2, rowEnd: 3 } },
  ]);

  const [selectedChild, setSelectedChild] = useState<number | undefined>(undefined);

  const handlePlacementChange = (index: number, placement: GridChildPlacement) => {
    setChildPlacements((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], placement };
      return next;
    });
  };

  // Display segmented options (matches existing codebase)
  const displayOptions = [
    { value: "flex", label: "Flex" },
    { value: "grid", label: "Grid" },
    { value: "block", label: "Block" },
    { value: "none", label: "None" },
  ];

  return (
    <div
      style={{
        width: 280,
        background: "var(--studio-bg)",
        padding: "12px 0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
        fontSize: 12,
        color: "var(--studio-text)",
      }}
    >
      {/* Display property */}
      <div style={{ padding: "0 16px", marginBottom: 8 }}>
        <div
          style={{
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--studio-text-dimmed)",
            marginBottom: 4,
          }}
        >
          Display
        </div>
        <div className="studio-segmented" style={{ width: "100%" }}>
          {displayOptions.map((opt) => (
            <button
              key={opt.value}
              className={display === opt.value ? "active" : ""}
              style={{ flex: 1, cursor: "pointer" }}
              onClick={() => setDisplay(opt.value)}
            >
              <span style={{ fontSize: 10 }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid input — only visible when display is grid */}
      {display === "grid" && (
        <div style={{ padding: "0 16px" }}>
          <GridInput
            config={config}
            children={childPlacements}
            selectedChild={selectedChild}
            onConfigChange={setConfig}
            onChildPlacementChange={handlePlacementChange}
          />
        </div>
      )}
    </div>
  );
}
