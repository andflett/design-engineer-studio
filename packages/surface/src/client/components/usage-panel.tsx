/**
 * Left panel showing a route-based tree of pages where the selected component is used.
 * Opens from "Component" mode in the editor.
 */
import { useState } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  FileTextIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import { useUsages } from "../lib/scan-hooks.js";
import { Tooltip } from "./tooltip.js";
import type { ComponentUsageRoute } from "../../server/lib/scan-usages.js";

interface UsagePanelProps {
  componentName: string | null;
  currentPath: string;
  onNavigate: (route: string) => void;
  onClose: () => void;
}

interface RouteTreeNode {
  segment: string;
  /** The URL path for this node, e.g. "/blog" — always set, even for non-page folders */
  path: string;
  /** Non-null if this node is an actual page (has page.tsx) */
  fullRoute: string | null;
  file: string | null;
  /** True if this route (or an ancestor segment) contains a dynamic segment like [slug] */
  isDynamic: boolean;
  children: Map<string, RouteTreeNode>;
}

export function UsagePanel({
  componentName,
  currentPath,
  onNavigate,
  onClose,
}: UsagePanelProps) {
  const usageData = useUsages();

  if (!componentName) return null;

  const routes = usageData?.usages[componentName] || [];

  if (routes.length === 0) {
    return (
      <div
        className="flex flex-col h-full"
        style={{ background: "var(--studio-surface)" }}
      >
        <PanelHeader
          componentName={componentName}
          count={0}
          onClose={onClose}
        />
        <div
          className="px-4 py-6 text-[11px] text-center"
          style={{ color: "var(--studio-text-dimmed)" }}
        >
          No page usages found for this component.
        </div>
      </div>
    );
  }

  const tree = buildRouteTree(routes);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--studio-surface)" }}
    >
      <PanelHeader
        componentName={componentName}
        count={routes.length}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto overflow-x-hidden studio-scrollbar py-1">
        <RouteTree
          node={tree}
          currentPath={currentPath}
          onNavigate={onNavigate}
          depth={0}
        />
      </div>
    </div>
  );
}

function PanelHeader({
  componentName,
  count,
  onClose,
}: {
  componentName: string;
  count: number;
  onClose: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
      style={{ borderColor: "var(--studio-border)" }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-wide flex-1 truncate"
        style={{ color: "var(--studio-text-muted)" }}
      >
        Pages using {componentName}
      </span>
      {count > 0 && (
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0"
          style={{
            color: "var(--studio-accent)",
            background: "var(--studio-accent-muted)",
          }}
        >
          {count}
        </span>
      )}
      <button
        onClick={onClose}
        className="studio-icon-btn"
        style={{ width: 20, height: 20 }}
      >
        <Cross2Icon />
      </button>
    </div>
  );
}

function RouteTree({
  node,
  currentPath,
  onNavigate,
  depth,
}: {
  node: RouteTreeNode;
  currentPath: string;
  onNavigate: (route: string) => void;
  depth: number;
}) {
  // Render children directly if root
  if (depth === 0) {
    // Root "/" page
    const hasRootPage = node.fullRoute !== null;
    return (
      <>
        {hasRootPage && (
          <RouteItem
            route="/"
            label="/"
            file={node.file}
            isActive={currentPath === "/"}
            isDynamic={false}
            onNavigate={onNavigate}
            depth={0}
          />
        )}
        {Array.from(node.children.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([segment, child]) => (
            <RouteTreeBranch
              key={segment}
              node={child}
              currentPath={currentPath}
              onNavigate={onNavigate}
              depth={0}
            />
          ))}
      </>
    );
  }

  return null;
}

function RouteTreeBranch({
  node,
  currentPath,
  onNavigate,
  depth,
}: {
  node: RouteTreeNode;
  currentPath: string;
  onNavigate: (route: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.size > 0;
  const isPage = node.fullRoute !== null;
  const isActive = isPage && currentPath === node.fullRoute;

  if (isPage && !hasChildren) {
    return (
      <RouteItem
        route={node.fullRoute!}
        label={node.segment}
        file={node.file}
        isActive={isActive}
        isDynamic={node.isDynamic}
        onNavigate={onNavigate}
        depth={depth}
      />
    );
  }

  return (
    <div>
      {isPage ? (
        <RouteItem
          route={node.fullRoute!}
          label={node.segment}
          file={node.file}
          isActive={isActive}
          isDynamic={node.isDynamic}
          onNavigate={onNavigate}
          depth={depth}
          hasChildren={hasChildren}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />
      ) : (
        <div
          className="flex items-center gap-1 w-full text-left"
          style={{
            padding: `4px 8px 4px ${8 + depth * 12}px`,
            fontSize: 11,
            color: "var(--studio-text-dimmed)",
            background: "none",
            border: "none",
            cursor: "pointer",
            transition: "color 0.1s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--studio-text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--studio-text-dimmed)"; }}
        >
          {hasChildren && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              style={{ display: "inline-flex", flexShrink: 0, cursor: "pointer" }}
            >
              {expanded ? (
                <ChevronDownIcon style={{ width: 10, height: 10 }} />
              ) : (
                <ChevronRightIcon style={{ width: 10, height: 10 }} />
              )}
            </span>
          )}
          <span
            onClick={() => onNavigate(node.path)}
            style={{ cursor: "pointer" }}
          >
            {node.segment}/
          </span>
        </div>
      )}
      {expanded &&
        Array.from(node.children.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([segment, child]) => (
            <RouteTreeBranch
              key={segment}
              node={child}
              currentPath={currentPath}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
    </div>
  );
}

function RouteItem({
  route,
  label,
  file,
  isActive,
  isDynamic,
  onNavigate,
  depth,
  hasChildren,
  expanded,
  onToggle,
}: {
  route: string;
  label: string;
  file: string | null;
  isActive: boolean;
  isDynamic: boolean;
  onNavigate: (route: string) => void;
  depth: number;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const parentRoute = route.replace(/\/\[.*$/, "") || "/";
  const tooltipContent = isDynamic
    ? `Dynamic route — navigate to ${parentRoute} to find a real page`
    : null;

  const item = (
    <div
      onClick={isDynamic ? undefined : () => onNavigate(route)}
      className="flex items-center gap-1.5 w-full text-left group"
      style={{
        padding: `5px 8px 5px ${8 + depth * 12}px`,
        fontSize: 11,
        fontWeight: isActive ? 600 : 400,
        fontStyle: isDynamic ? "italic" : undefined,
        color: isDynamic
          ? "var(--studio-text-dimmed)"
          : isActive
            ? "var(--studio-accent)"
            : "var(--studio-text)",
        background: isActive ? "var(--studio-accent-muted)" : "transparent",
        border: "none",
        borderRadius: 4,
        margin: "0 4px",
        cursor: isDynamic ? "default" : "pointer",
        transition: "background 0.1s",
        opacity: isDynamic ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isActive && !isDynamic) e.currentTarget.style.background = "var(--studio-surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isActive && !isDynamic) e.currentTarget.style.background = "transparent";
      }}
      title={!isDynamic ? (file || route) : undefined}
    >
      {hasChildren && onToggle ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={{ display: "inline-flex", flexShrink: 0, cursor: "pointer" }}
        >
          {expanded ? (
            <ChevronDownIcon style={{ width: 10, height: 10 }} />
          ) : (
            <ChevronRightIcon style={{ width: 10, height: 10 }} />
          )}
        </span>
      ) : (
        <FileTextIcon
          style={{
            width: 11,
            height: 11,
            flexShrink: 0,
            opacity: isDynamic ? 0.3 : 0.5,
          }}
        />
      )}
      <span className="truncate">{label}</span>
    </div>
  );

  if (isDynamic) {
    return (
      <Tooltip content={tooltipContent} side="right">
        {item}
      </Tooltip>
    );
  }

  return item;
}

/**
 * Build a tree structure from flat route list.
 * e.g. ["/", "/blog", "/blog/[slug]", "/dashboard"] ->
 *   root -> { "/": page, blog: { page, [slug]: page }, dashboard: page }
 */
function isDynamicSegment(seg: string): boolean {
  return seg.startsWith("[") && seg.endsWith("]");
}

function buildRouteTree(routes: ComponentUsageRoute[]): RouteTreeNode {
  const root: RouteTreeNode = {
    segment: "",
    path: "/",
    fullRoute: null,
    file: null,
    isDynamic: false,
    children: new Map(),
  };

  for (const { route, file } of routes) {
    if (route === "/") {
      root.fullRoute = "/";
      root.file = file;
      continue;
    }

    const segments = route.replace(/^\//, "").split("/");
    let current = root;
    let hasDynamic = false;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (isDynamicSegment(seg)) hasDynamic = true;
      const segPath = "/" + segments.slice(0, i + 1).join("/");
      if (!current.children.has(seg)) {
        current.children.set(seg, {
          segment: seg,
          path: segPath,
          fullRoute: null,
          file: null,
          isDynamic: hasDynamic,
          children: new Map(),
        });
      }
      current = current.children.get(seg)!;
    }

    current.fullRoute = route;
    current.file = file;
  }

  return root;
}
