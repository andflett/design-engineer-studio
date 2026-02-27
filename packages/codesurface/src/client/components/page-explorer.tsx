/**
 * Component tree explorer — left panel showing a filtered hierarchy of
 * React components and semantic HTML landmarks on the current page.
 *
 * The tree data is extracted by the CodeSurface component in the target app
 * (via React fiber walking) and sent over postMessage. This component is
 * framework-agnostic — it renders whatever ComponentTreeNode[] it receives.
 *
 * Nodes are grouped by scope (layout vs page) when scope data is available.
 * The layout section is collapsed by default since designers typically work
 * on page content rather than the persistent shell.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  Component1Icon,
  BoxIcon,
  InfoCircledIcon,
} from "@radix-ui/react-icons";
import type { ComponentTreeNode } from "../../shared/protocol.js";

interface PageExplorerProps {
  tree: ComponentTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
  onHoverEnd: () => void;
}

export function PageExplorer({
  tree,
  selectedId,
  onSelect,
  onHover,
  onHoverEnd,
}: PageExplorerProps) {
  const [filter, setFilter] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [layoutExpanded, setLayoutExpanded] = useState(false);
  const [pageExpanded, setPageExpanded] = useState(true);
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
  };

  const isEmpty = tree.length === 0 || (filter && layoutNodes.length === 0 && pageNodes.length === 0 && allNodes.length === 0);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--studio-surface)" }}
    >
      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden studio-scrollbar">
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
          /* No scope data — render flat tree */
          <div className="py-1">
            {allNodes.map((node) => (
              <TreeNodeItem
                key={node.id}
                node={node}
                depth={0}
                {...treeItemProps}
              />
            ))}
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
  children,
}: {
  label: string;
  expanded: boolean;
  onToggle?: () => void;
  alwaysExpanded?: boolean;
  explainer?: string;
  children: React.ReactNode;
}) {
  const isExpanded = alwaysExpanded || expanded;

  return (
    <div>
      {/* Section header */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 select-none"
        style={{
          cursor: alwaysExpanded ? "default" : "pointer",
          borderBottom: "1px solid var(--studio-border)",
          marginTop: label !== "Layout" ? 0 : undefined,
        }}
        onClick={alwaysExpanded ? undefined : onToggle}
      >
        {!alwaysExpanded && (
          <span style={{ display: "inline-flex", flexShrink: 0 }}>
            {isExpanded ? (
              <ChevronDownIcon style={{ width: 10, height: 10, color: "var(--studio-text-dimmed)" }} />
            ) : (
              <ChevronRightIcon style={{ width: 10, height: 10, color: "var(--studio-text-dimmed)" }} />
            )}
          </span>
        )}
        <span
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--studio-text-dimmed)" }}
        >
          {label}
        </span>
      </div>

      {/* Explainer (only shown when section is expanded) */}
      {isExpanded && explainer && (
        <div className="studio-tab-explainer" style={{ margin: "6px 8px", padding: "8px 10px" }}>
          <InfoCircledIcon />
          <span>{explainer}</span>
        </div>
      )}

      {/* Children */}
      {isExpanded && <div className="py-1">{children}</div>}
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
}) {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const isDesignSystem = node.dataSlot !== null;

  return (
    <div>
      <div
        ref={isSelected ? selectedRef : undefined}
        className="flex items-center gap-1 w-full group overflow-hidden"
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
          borderRadius: 4,
          margin: "0 4px",
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
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            style={{
              display: "inline-flex",
              flexShrink: 0,
              width: 14,
              justifyContent: "center",
            }}
          >
            {isExpanded ? (
              <ChevronDownIcon style={{ width: 10, height: 10 }} />
            ) : (
              <ChevronRightIcon style={{ width: 10, height: 10 }} />
            )}
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
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

      {/* Children */}
      {isExpanded &&
        hasChildren &&
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
