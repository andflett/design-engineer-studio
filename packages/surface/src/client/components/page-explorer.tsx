/**
 * Component tree explorer — left panel showing a filtered hierarchy of
 * React components and semantic HTML landmarks on the current page.
 *
 * The tree data is extracted by the Surface component in the target app
 * (via React fiber walking) and sent over postMessage. This component is
 * framework-agnostic — it renders whatever ComponentTreeNode[] it receives.
 *
 * Nodes are grouped by scope (layout vs page) when scope data is available.
 * The layout section is collapsed by default since designers typically work
 * on page content rather than the persistent shell.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  Component1Icon,
  BoxIcon,
  InfoCircledIcon,
  LayersIcon,
} from "@radix-ui/react-icons";
import type { ComponentTreeNode } from "../../shared/protocol.js";
import { ChevronsDownUp, ChevronsUpDown, ListTree } from "lucide-react";
import { Tooltip } from "./tooltip.js";

interface PageExplorerProps {
  tree: ComponentTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
  onHoverEnd: () => void;
  treeMode: "components" | "dom";
  onTreeModeChange: (mode: "components" | "dom") => void;
}

export function PageExplorer({
  tree,
  selectedId,
  onSelect,
  onHover,
  onHoverEnd,
  treeMode,
  onTreeModeChange,
}: PageExplorerProps) {
  const [filter, setFilter] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [layoutExpanded, setLayoutExpanded] = useState(false);
  const [pageExpanded, setPageExpanded] = useState(true);
  const [collapsedChainIds, setCollapsedChainIds] = useState<Set<string>>(new Set());
  const selectedRef = useRef<HTMLDivElement>(null);

  // Split tree into layout and page sections
  const { layoutNodes, pageNodes } = groupByScope(filter ? filterTree(tree, filter.toLowerCase()) : tree);
  const hasScopes = layoutNodes.length > 0 && pageNodes.length > 0;

  // Auto-expand path to selected element when selection changes
  useEffect(() => {
    if (!selectedId || tree.length === 0) return;
    const path = findPathToNode(tree, selectedId);
    if (path.length > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const id of path) next.add(id);
        return next;
      });
      // Auto-expand the section containing the selected node
      if (hasScopes) {
        if (isNodeInList(layoutNodes, selectedId)) {
          setLayoutExpanded(true);
        } else if (isNodeInList(pageNodes, selectedId)) {
          setPageExpanded(true);
        }
      }
    }
  }, [selectedId, tree]);

  // Detect collapsible chains — only reset when treeMode changes.
  // Tree updates from MutationObserver should NOT reset user's expand/collapse choices.
  const prevTreeModeRef = useRef(treeMode);
  useEffect(() => {
    if (tree.length === 0) return;
    const modeChanged = prevTreeModeRef.current !== treeMode;
    prevTreeModeRef.current = treeMode;

    if (modeChanged) {
      // Mode changed — re-detect and reset collapsed state
      const chainIds = new Set<string>();
      if (treeMode === "components") {
        collectChainRootIds(tree, chainIds);
      }
      setCollapsedChainIds(chainIds);
    } else if (collapsedChainIds.size === 0 && treeMode === "components") {
      // First tree load in components mode — auto-collapse chains
      const chainIds = new Set<string>();
      collectChainRootIds(tree, chainIds);
      if (chainIds.size > 0) setCollapsedChainIds(chainIds);
    }
  }, [tree, treeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand chains containing the selected node
  useEffect(() => {
    if (!selectedId || collapsedChainIds.size === 0) return;
    // Check if selectedId is inside any collapsed chain — expand it
    setCollapsedChainIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const rootId of prev) {
        // Find the chain root node and check if selectedId is within it
        const chainRoot = findNodeById(tree, rootId);
        if (chainRoot) {
          const chain = detectChain(chainRoot);
          if (chain && chain.nodes.some((n) => n.id === selectedId)) {
            next.delete(rootId);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll selected node into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedId]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleChainCollapsed = useCallback((rootId: string) => {
    setCollapsedChainIds((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  }, []);

  // Auto-expand page nodes on first tree load (but not layout)
  useEffect(() => {
    if (tree.length > 0 && expandedIds.size === 0) {
      const ids = new Set<string>();
      // Only auto-expand page nodes
      if (hasScopes) {
        collectAllIds(pageNodes, ids);
      } else {
        collectAllIds(tree, ids);
      }
      setExpandedIds(ids);
    }
  }, [tree.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const allNodes = hasScopes ? [] : (filter ? filterTree(tree, filter.toLowerCase()) : tree);

  const treeItemProps = {
    selectedId,
    selectedRef,
    expandedIds,
    onToggle: toggleExpanded,
    onSelect,
    onHover,
    onHoverEnd,
    collapsedChainIds,
    onToggleChain: toggleChainCollapsed,
  };

  const isEmpty = tree.length === 0 || (filter && layoutNodes.length === 0 && pageNodes.length === 0 && allNodes.length === 0);

  const isDomMode = treeMode === "dom";
  const toggleDomMode = useCallback(() => {
    onTreeModeChange(isDomMode ? "components" : "dom");
  }, [isDomMode, onTreeModeChange]);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--studio-surface)" }}
    >
      {/* Tree */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isEmpty ? (
          <div
            className="px-4 py-6 text-[11px] text-center"
            style={{ color: "var(--studio-text-dimmed)" }}
          >
            {filter ? "No matching components." : "No components found on this page."}
          </div>
        ) : hasScopes ? (
          <>
            {/* Layout section — collapsed by default */}
            {layoutNodes.length > 0 && (
              <ScopeSection
                label="Layout"
                expanded={layoutExpanded}
                onToggle={() => setLayoutExpanded(!layoutExpanded)}
                isDomMode={isDomMode}
                onToggleDomMode={toggleDomMode}
              >
                {layoutNodes.map((node) => (
                  <TreeNodeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    {...treeItemProps}
                  />
                ))}
              </ScopeSection>
            )}

            {/* Page section — expanded by default */}
            {pageNodes.length > 0 && (
              <ScopeSection
                label="Page"
                expanded={pageExpanded}
                onToggle={() => setPageExpanded(!pageExpanded)}
                isDomMode={isDomMode}
                onToggleDomMode={toggleDomMode}
                flex
              >
                {pageNodes.map((node) => (
                  <TreeNodeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    {...treeItemProps}
                  />
                ))}
              </ScopeSection>
            )}
          </>
        ) : (
          /* No scope data — render flat tree with toggle */
          <div className="flex flex-col flex-1 min-h-0">
            <div
              className="flex justify-between items-center px-3 py-2 shrink-0"
              style={{ borderBottom: "1px solid var(--studio-border-subtle)" }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--studio-text-muted)" }}
              >
                Elements
              </span>
              <Tooltip
                content={isDomMode ? "Show components only" : "Show all elements"}
                side="bottom"
              >
                <button
                  className="studio-icon-btn"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 3,
                    color: isDomMode ? "var(--studio-accent)" : undefined,
                    opacity: isDomMode ? 1 : 0.5,
                  }}
                  onClick={toggleDomMode}
                >
                  {isDomMode ? (
                    <ListTree style={{ width: 13, height: 13 }} strokeWidth={1.5} />
                  ) : (
                    <LayersIcon style={{ width: 13, height: 13 }} />
                  )}
                </button>
              </Tooltip>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-auto studio-scrollbar py-1">
              {allNodes.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  {...treeItemProps}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A collapsible section header that groups tree nodes by scope.
 */
function ScopeSection({
  label,
  expanded,
  onToggle,
  alwaysExpanded,
  explainer,
  flex,
  isDomMode,
  onToggleDomMode,
  children,
}: {
  label: string;
  expanded: boolean;
  onToggle?: () => void;
  alwaysExpanded?: boolean;
  explainer?: string;
  /** If true, section grows to fill remaining space (use for the last/main section) */
  flex?: boolean;
  /** Whether DOM view is active */
  isDomMode?: boolean;
  /** Toggle DOM view on/off */
  onToggleDomMode?: () => void;
  children: React.ReactNode;
}) {
  const isExpanded = alwaysExpanded || expanded;

  return (
    <div
      className="flex flex-col"
      style={{
        borderBottom: "1px solid var(--studio-border)",
        flex: flex && isExpanded ? "1 1 0" : "0 0 auto",
        minHeight: 0,
      }}
    >
      {/* Section header — stays pinned, never scrolls */}
      <div
        className="flex justify-between items-center gap-1.5 px-3 py-3 select-none shrink-0"
        style={{
          cursor: alwaysExpanded ? "default" : "pointer",
          borderBottom: !isExpanded
            ? ""
            : "1px solid var(--studio-border-subtle)",
        }}
        onClick={alwaysExpanded ? undefined : onToggle}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--studio-text-muted)" }}
        >
          {label}
        </span>
        <div className="flex items-center gap-0.5">
          {onToggleDomMode && (
            <Tooltip
              content={isDomMode ? "Show components only" : "Show all elements"}
              side="bottom"
            >
              <button
                className="studio-icon-btn"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 3,
                  color: isDomMode ? "var(--studio-accent)" : undefined,
                  opacity: isDomMode ? 1 : 0.5,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDomMode();
                }}
              >
                {isDomMode ? (
                  <ListTree style={{ width: 13, height: 13 }} strokeWidth={1.5} />
                ) : (
                  <LayersIcon style={{ width: 13, height: 13 }} />
                )}
              </button>
            </Tooltip>
          )}
          {!alwaysExpanded && (
            <button className="studio-icon-btn" style={{ width: 20, height: 20, borderRadius: 3 }}>
              {isExpanded ? (
                <ChevronsDownUp style={{ width: 13, height: 13 }} />
              ) : (
                <ChevronsUpDown style={{ width: 13, height: 13 }} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Explainer (only shown when section is expanded) */}
      {isExpanded && explainer && (
        <div
          className="studio-tab-explainer shrink-0"
          style={{ margin: "6px 8px", padding: "8px 10px" }}
        >
          <InfoCircledIcon />
          <span>{explainer}</span>
        </div>
      )}

      {/* Children — scrollable, header stays pinned */}
      {isExpanded && (
        <div className="overflow-y-auto overflow-x-auto studio-scrollbar py-2" style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function TreeNodeItem({
  node,
  depth,
  selectedId,
  selectedRef,
  expandedIds,
  onToggle,
  onSelect,
  onHover,
  onHoverEnd,
  collapsedChainIds,
  onToggleChain,
}: {
  node: ComponentTreeNode;
  depth: number;
  selectedId: string | null;
  selectedRef: React.RefObject<HTMLDivElement | null>;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
  onHoverEnd: () => void;
  collapsedChainIds: Set<string>;
  onToggleChain: (rootId: string) => void;
}) {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const isDesignSystem = node.dataSlot !== null;

  // Check for collapsible chain starting at this node
  const chain = useMemo(() => detectChain(node), [node]);
  const isChainRoot = chain !== null;
  const isChainCollapsed = isChainRoot && collapsedChainIds.has(node.id);

  // When this node is a collapsed chain root, show summary line
  const chainCount = chain ? chain.nodes.length - 1 : 0; // additional nested nodes
  const effectiveChildren = isChainCollapsed ? chain!.innerChildren : node.children;
  const effectiveHasChildren = isChainCollapsed ? effectiveChildren.length > 0 : hasChildren;

  return (
    <div>
      <div
        ref={isSelected ? selectedRef : undefined}
        className="flex items-center gap-1 group whitespace-nowrap"
        style={{
          padding: `3px 8px 3px ${8 + depth * 14}px`,
          fontSize: 11,
          fontWeight: isDesignSystem ? 500 : 400,
          color: isSelected
            ? "var(--studio-accent)"
            : isDesignSystem
              ? "var(--studio-text)"
              : "var(--studio-text-muted)",
          background: isSelected ? "var(--studio-accent-muted)" : "transparent",
          borderRadius: 0,

          cursor: "pointer",
          transition: "background 0.1s",
        }}
        onClick={() => onSelect(node.id)}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = "var(--studio-surface-hover)";
          onHover(node.id);
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = "transparent";
          onHoverEnd();
        }}
      >
        {/* Expand/collapse toggle */}
        {effectiveHasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="studio-icon-btn"
            style={{ width: 16, height: 16, borderRadius: 3 }}
          >
            {isExpanded ? (
              <ChevronDownIcon style={{ width: 10, height: 10 }} />
            ) : (
              <ChevronRightIcon style={{ width: 10, height: 10 }} />
            )}
          </button>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}

        {/* Icon */}
        {node.type === "component" ? (
          <Component1Icon
            style={{
              width: 11,
              height: 11,
              flexShrink: 0,
              opacity: isDesignSystem ? 1 : 0.5,
              color: isDesignSystem ? "var(--studio-accent)" : undefined,
            }}
          />
        ) : (
          <BoxIcon
            style={{
              width: 11,
              height: 11,
              flexShrink: 0,
              opacity: 0.4,
            }}
          />
        )}

        {/* Name */}
        <span className="truncate">{node.name}</span>

        {/* Chain badge — show +N count for collapsed chains */}
        {isChainRoot && chainCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleChain(node.id);
            }}
            className="shrink-0 inline-flex items-center justify-center"
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: "var(--studio-text-dimmed)",
              background: "var(--studio-surface-hover)",
              borderRadius: 3,
              padding: "0 4px",
              height: 15,
              lineHeight: "15px",
              cursor: "pointer",
            }}
            title={isChainCollapsed ? "Expand nested elements" : "Collapse nested elements"}
          >
            {isChainCollapsed ? `+${chainCount}` : `−${chainCount}`}
          </button>
        )}

        {/* Text preview — only direct text, truncated */}
        {node.textContent && (
          <span
            className="truncate ml-1"
            style={{
              color: "var(--studio-text-dimmed)",
              fontSize: 10,
              fontWeight: 400,
            }}
          >
            {node.textContent}
          </span>
        )}
      </div>

      {/* Children — when chain is collapsed, show innerChildren at depth+1 */}
      {isExpanded && isChainCollapsed && effectiveChildren.map((child) => (
        <TreeNodeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          selectedRef={selectedRef}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onSelect={onSelect}
          onHover={onHover}
          onHoverEnd={onHoverEnd}
          collapsedChainIds={collapsedChainIds}
          onToggleChain={onToggleChain}
        />
      ))}

      {/* Children — normal rendering when not collapsed */}
      {isExpanded && !isChainCollapsed && hasChildren &&
        node.children.map((child) => (
          <TreeNodeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            selectedRef={selectedRef}
            expandedIds={expandedIds}
            onToggle={onToggle}
            onSelect={onSelect}
            onHover={onHover}
            onHoverEnd={onHoverEnd}
            collapsedChainIds={collapsedChainIds}
            onToggleChain={onToggleChain}
          />
        ))}
    </div>
  );
}

/**
 * Split tree into layout and page groups.
 *
 * The tree from the framework plugin looks like:
 *   <nav scope="layout">        ← layout content
 *   <main scope="layout">       ← layout container that holds page content
 *     <section scope="page">    ← page content
 *     Card scope="page"         ← page content
 *
 * We need to split at the layout→page boundary:
 * - Layout section: nodes that are layout-scoped AND don't contain page content
 *   (e.g. <nav>), plus layout containers shown with only their layout children
 * - Page section: nodes that are page-scoped, plus page children extracted
 *   from mixed layout containers like <main>
 */
function groupByScope(nodes: ComponentTreeNode[]): {
  layoutNodes: ComponentTreeNode[];
  pageNodes: ComponentTreeNode[];
} {
  const layoutNodes: ComponentTreeNode[] = [];
  const pageNodes: ComponentTreeNode[] = [];

  for (const node of nodes) {
    splitNode(node, layoutNodes, pageNodes);
  }

  return { layoutNodes, pageNodes };
}

function splitNode(
  node: ComponentTreeNode,
  layoutOut: ComponentTreeNode[],
  pageOut: ComponentTreeNode[],
): void {
  const scope = node.scope;

  // Pure page node — everything goes to page
  if (scope === "page") {
    pageOut.push(node);
    return;
  }

  // Layout node — check if it contains page-scoped children
  if (scope === "layout") {
    const hasPageChildren = node.children.some(c => hasScope(c, "page"));

    if (!hasPageChildren) {
      // Pure layout node (like <nav>) — goes to layout
      layoutOut.push(node);
      return;
    }

    // Mixed container (like <main scope="layout"> with page children).
    // Keep layout-only children in layout section under this container,
    // and promote page children to the page section.
    const layoutChildren: ComponentTreeNode[] = [];
    for (const child of node.children) {
      if (hasScope(child, "page")) {
        pageOut.push(child);
      } else {
        layoutChildren.push(child);
      }
    }
    // If the container has layout-only children, show it in layout
    if (layoutChildren.length > 0) {
      layoutOut.push({ ...node, children: layoutChildren });
    }
    return;
  }

  // No scope — check children for mixed content
  const hasLayout = node.children.some(c => hasScope(c, "layout"));
  const hasPage = node.children.some(c => hasScope(c, "page"));

  if (hasLayout && hasPage) {
    // Mixed — split children
    for (const child of node.children) {
      splitNode(child, layoutOut, pageOut);
    }
  } else if (hasLayout) {
    layoutOut.push(node);
  } else {
    pageOut.push(node);
  }
}

/** Check if a node or any descendant has the given scope. */
function hasScope(node: ComponentTreeNode, scope: "layout" | "page"): boolean {
  if (node.scope === scope) return true;
  return node.children.some(c => hasScope(c, scope));
}

/**
 * Find the path of node IDs from the root to the target node.
 * Returns an array of ancestor IDs (including the target) for expanding.
 */
function findPathToNode(
  nodes: ComponentTreeNode[],
  targetId: string,
  path: string[] = []
): string[] {
  for (const node of nodes) {
    if (node.id === targetId) return [...path, node.id];
    if (node.children.length > 0) {
      const found = findPathToNode(node.children, targetId, [...path, node.id]);
      if (found.length > 0) return found;
    }
  }
  return [];
}

/**
 * Check if a node with the given ID exists in a node list (recursive).
 */
function isNodeInList(nodes: ComponentTreeNode[], id: string): boolean {
  for (const node of nodes) {
    if (node.id === id) return true;
    if (isNodeInList(node.children, id)) return true;
  }
  return false;
}

/**
 * Filter the tree to only show nodes matching the filter string.
 * A node is included if it matches or any of its descendants match.
 */
function filterTree(
  nodes: ComponentTreeNode[],
  filter: string
): ComponentTreeNode[] {
  const results: ComponentTreeNode[] = [];
  for (const node of nodes) {
    const nameMatch = node.name.toLowerCase().includes(filter);
    const textMatch = node.textContent.toLowerCase().includes(filter);
    const filteredChildren = filterTree(node.children, filter);

    if (nameMatch || textMatch || filteredChildren.length > 0) {
      results.push({
        ...node,
        children: filteredChildren,
      });
    }
  }
  return results;
}

/**
 * Collect all node IDs in the tree (for expand-all).
 */
function collectAllIds(nodes: ComponentTreeNode[], ids: Set<string>): void {
  for (const node of nodes) {
    ids.add(node.id);
    if (node.children.length > 0) collectAllIds(node.children, ids);
  }
}

// --- Chain detection for collapsing nested div chains ---

/** Block-level layout tags that form collapsible chains */
const blockLayoutTags = new Set([
  "div", "section", "article", "aside", "main",
  "header", "footer", "nav", "form", "fieldset",
  "figure", "details",
]);

/** Check if a node is a block-level element (not a component) */
function isBlockElement(node: ComponentTreeNode): boolean {
  if (node.type !== "element") return false;
  // node.name is like "<div>", extract the tag
  const tag = node.name.replace(/[<>]/g, "");
  return blockLayoutTags.has(tag);
}

interface CollapsedChain {
  /** The nodes in the chain, outermost first */
  nodes: ComponentTreeNode[];
  /** Children of the deepest node — what appears below the collapsed summary */
  innerChildren: ComponentTreeNode[];
}

/**
 * Detect a collapsible chain starting from the given node.
 * A chain is a sequence of 2+ block-level element nodes where each has
 * exactly one child that is also a block-level element.
 * Returns null if node doesn't start a chain (< 2 deep).
 */
function detectChain(node: ComponentTreeNode): CollapsedChain | null {
  if (!isBlockElement(node)) return null;

  const chain: ComponentTreeNode[] = [node];
  let current = node;

  while (true) {
    // Check if current has exactly one child that is a block element
    const blockChildren = current.children.filter(isBlockElement);
    if (blockChildren.length !== 1) break;
    // Also check there are no non-block children (components, text elements, etc.)
    // that would make collapsing confusing
    if (current.children.length !== 1) break;

    chain.push(blockChildren[0]);
    current = blockChildren[0];
  }

  // Need at least 2 nodes for a chain to be worth collapsing
  if (chain.length < 2) return null;

  return {
    nodes: chain,
    innerChildren: current.children,
  };
}

/**
 * Walk the tree and collect IDs of nodes that are chain roots.
 */
function collectChainRootIds(nodes: ComponentTreeNode[], ids: Set<string>): void {
  for (const node of nodes) {
    const chain = detectChain(node);
    if (chain) {
      ids.add(node.id);
      // Skip chain nodes — start collecting from innerChildren
      collectChainRootIds(chain.innerChildren, ids);
    } else {
      if (node.children.length > 0) collectChainRootIds(node.children, ids);
    }
  }
}

/**
 * Find a node by ID in the tree.
 */
function findNodeById(nodes: ComponentTreeNode[], id: string): ComponentTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}
