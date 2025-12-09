"use client";

import * as React from "react";
import { Plus, X, Copy, Check, Variable } from "lucide-react";
import { cn } from "@/lib/utils";

interface PathNode {
  id: string;
  name: string;
  children: PathNode[];
}

interface AccountCategory {
  id: string;
  name: string;
  description: string;
  paths: PathNode[];
}

interface ChartBuilderProps {
  value: string;
  onChange: (yaml: string) => void;
}

function genId() {
  return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Convert to YAML
function toYaml(categories: AccountCategory[]): string {
  let yaml = "";
  for (const cat of categories) {
    yaml += `${cat.name}:\n`;
    yaml += `  description: "${cat.description}"\n`;
    yaml += `  paths:\n`;
    const paths = flattenPaths(cat.paths, cat.name);
    for (const [key, path] of Object.entries(paths)) {
      yaml += `    ${key}: "${path}"\n`;
    }
    yaml += "\n";
  }
  yaml += `world:\n  description: "Unlimited source"\n  paths:\n    source: "world"\n`;
  return yaml;
}

function flattenPaths(nodes: PathNode[], prefix: string): Record<string, string> {
  const result: Record<string, string> = {};
  function traverse(node: PathNode, parts: string[]) {
    const newParts = [...parts, node.name];
    if (node.children.length === 0) {
      const key = node.name.replace(/^\$/, "");
      result[key] = newParts.join(":");
    } else {
      for (const child of node.children) {
        traverse(child, newParts);
      }
    }
  }
  for (const node of nodes) {
    traverse(node, [prefix]);
  }
  return result;
}

function parseYaml(yaml: string): AccountCategory[] {
  const categories: AccountCategory[] = [];
  const lines = yaml.split("\n");
  let currentCategory: AccountCategory | null = null;
  let inPaths = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (!line.startsWith(" ") && trimmed.endsWith(":")) {
      const name = trimmed.slice(0, -1);
      if (name === "world") continue;
      currentCategory = { id: genId(), name, description: "", paths: [] };
      categories.push(currentCategory);
      inPaths = false;
      continue;
    }
    if (!currentCategory) continue;
    if (trimmed.startsWith("description:")) {
      const match = trimmed.match(/description:\s*"([^"]*)"/);
      if (match) currentCategory.description = match[1];
      continue;
    }
    if (trimmed === "paths:") {
      inPaths = true;
      continue;
    }
    if (inPaths && trimmed.includes(":")) {
      // Match path definitions like: main: "cardholder:$account_id:main"
      const match = trimmed.match(/[\w$]+:\s*"([^"]*)"/);
      if (match) {
        const fullPath = match[1]; // e.g., "cardholder:$account_id:main"
        // Split path and skip the first segment (category name)
        const parts = fullPath.split(":");
        if (parts.length > 1) {
          // Only take parts after the category name
          const pathParts = parts.slice(1);
          addPathToTree(currentCategory.paths, pathParts);
        }
      }
    }
  }
  return categories;
}

function addPathToTree(nodes: PathNode[], parts: string[]) {
  if (parts.length === 0) return;
  const [first, ...rest] = parts;
  let node = nodes.find((n) => n.name === first);
  if (!node) {
    node = { id: genId(), name: first, children: [] };
    nodes.push(node);
  }
  if (rest.length > 0) {
    addPathToTree(node.children, rest);
  }
}

export function ChartBuilder({ value, onChange }: ChartBuilderProps) {
  const [categories, setCategories] = React.useState<AccountCategory[]>(() => parseYaml(value));
  const [copied, setCopied] = React.useState(false);
  const isInternalUpdate = React.useRef(false);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Debounced onChange to prevent excessive re-renders during typing
  React.useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      isInternalUpdate.current = true;
      onChange(toYaml(categories));
    }, 300); // 300ms debounce
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [categories, onChange]);

  // Sync from external value changes (preset loading)
  React.useEffect(() => {
    // Skip if this was triggered by our own internal update
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    // Parse and set the new value
    setCategories(parseYaml(value));
  }, [value]);

  const copyYaml = async () => {
    await navigator.clipboard.writeText(toYaml(categories));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  const addCategory = () => {
    setCategories([...categories, { id: genId(), name: "category_name", description: "Description here", paths: [] }]);
  };

  const updateCategory = (id: string, field: "name" | "description", val: string) => {
    setCategories(categories.map((c) => (c.id === id ? { ...c, [field]: val } : c)));
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id));
  };

  const addRootPath = (categoryId: string) => {
    setCategories(categories.map((c) => {
      if (c.id === categoryId) {
        return { ...c, paths: [...c.paths, { id: genId(), name: "segment", children: [] }] };
      }
      return c;
    }));
  };

  const updateNode = (categoryId: string, nodeId: string, newName: string) => {
    setCategories(categories.map((c) => {
      if (c.id === categoryId) {
        return { ...c, paths: updateNodeInTree(c.paths, nodeId, newName) };
      }
      return c;
    }));
  };

  const addChildNode = (categoryId: string, parentId: string) => {
    setCategories(categories.map((c) => {
      if (c.id === categoryId) {
        return { ...c, paths: addChildToNode(c.paths, parentId) };
      }
      return c;
    }));
  };

  const deleteNode = (categoryId: string, nodeId: string) => {
    setCategories(categories.map((c) => {
      if (c.id === categoryId) {
        return { ...c, paths: deleteNodeFromTree(c.paths, nodeId) };
      }
      return c;
    }));
  };

  const makeVariable = (categoryId: string, nodeId: string, currentName: string) => {
    // Toggle $ prefix
    const newName = currentName.startsWith("$") 
      ? currentName.slice(1) 
      : `$${currentName.replace(/^\$/, "")}`;
    updateNode(categoryId, nodeId, newName);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2 text-xs">
        <button onClick={copyYaml} className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200">
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy YAML"}
        </button>
      </div>

      {/* YAML-like Editor */}
      <div className="font-mono text-sm bg-zinc-950 rounded-lg border border-zinc-800 p-4 space-y-1 overflow-x-auto">
        <div className="text-zinc-600 text-xs mb-2"># Chart of Accounts</div>
        
        {categories.map((cat) => (
          <div key={cat.id} className="group/cat">
            {/* Category name */}
            <div className="flex items-center gap-1">
              <EditableField
                value={cat.name}
                onChange={(v) => updateCategory(cat.id, "name", v.toLowerCase().replace(/\s+/g, "_"))}
                className="text-purple-400 font-medium"
                placeholder="category_name"
              />
              <span className="text-zinc-600">:</span>
              <button 
                onClick={() => deleteCategory(cat.id)} 
                className="ml-1 p-1.5 rounded-md transition-all flex items-center justify-center min-w-[28px] min-h-[28px] text-zinc-500 bg-zinc-800/50 border border-dashed border-zinc-700 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10" 
                title="Delete category"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Description */}
            <div className="pl-4 flex items-center gap-1">
              <span className="text-zinc-500">description:</span>
              <span className="text-zinc-600">"</span>
              <EditableField
                value={cat.description}
                onChange={(v) => updateCategory(cat.id, "description", v)}
                className="text-amber-300/80"
                placeholder="Account description"
              />
              <span className="text-zinc-600">"</span>
            </div>

            {/* Paths */}
            <div className="pl-4">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">paths:</span>
                <button 
                  onClick={() => addRootPath(cat.id)} 
                  className="p-1.5 rounded-md transition-all flex items-center justify-center min-w-[28px] min-h-[28px] text-zinc-500 bg-zinc-800/50 border border-dashed border-zinc-700 hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10" 
                  title="Add path segment"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              
              <div className="pl-4">
                {cat.paths.map((node, i) => (
                  <PathNodeLine
                    key={node.id}
                    node={node}
                    categoryId={cat.id}
                    categoryName={cat.name}
                    depth={0}
                    isLast={i === cat.paths.length - 1}
                    onUpdate={updateNode}
                    onAddChild={addChildNode}
                    onDelete={deleteNode}
                    onMakeVariable={makeVariable}
                  />
                ))}
                {cat.paths.length === 0 && (
                  <div className="text-zinc-700 text-xs italic pl-2">Click + to add path segments</div>
                )}
              </div>
            </div>
            
            <div className="h-3" />
          </div>
        ))}

        {/* Add category */}
        <button 
          onClick={addCategory} 
          className="flex items-center gap-2 px-3 py-2 rounded-md transition-all text-zinc-500 bg-zinc-800/30 border border-dashed border-zinc-700 hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm">add category</span>
        </button>

        {/* World (static) */}
        <div className="pt-3 border-t border-zinc-800/50 mt-3 text-zinc-600">
          <div>world:</div>
          <div className="pl-4">description: "Unlimited source"</div>
          <div className="pl-4">paths:</div>
          <div className="pl-8">source: "world"</div>
        </div>
      </div>

      {/* Help text */}
      <div className="flex items-center gap-4 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <Variable className="h-3 w-3 text-cyan-500" />
          <code className="text-cyan-400">$name</code> = dynamic variable (click <Variable className="h-2.5 w-2.5 inline" /> to toggle)
        </span>
        <span>
          Click text to edit • Hover for actions
        </span>
      </div>
    </div>
  );
}

// Auto-sizing editable field
function EditableField({ 
  value, 
  onChange, 
  className, 
  placeholder 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  className?: string;
  placeholder?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [width, setWidth] = React.useState(0);
  
  // Measure text width
  React.useEffect(() => {
    const measureText = value || placeholder || "";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = "14px ui-monospace, monospace";
      const textWidth = ctx.measureText(measureText).width;
      setWidth(Math.max(textWidth + 20, 70)); // min 70px, add padding
    }
  }, [value, placeholder]);

  const isEmpty = !value;

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: `${width}px` }}
      className={cn(
        // Always show a subtle dashed border to indicate editability
        "bg-zinc-800/40 border border-dashed border-zinc-700/60 rounded px-2 py-0.5 outline-none transition-all",
        // Hover makes it more prominent
        "hover:border-zinc-500 hover:bg-zinc-800/60",
        // Focus shows solid border
        "focus:border-solid focus:border-purple-500/70 focus:bg-zinc-900",
        isEmpty && "text-zinc-500 italic",
        className
      )}
    />
  );
}

// Path node rendered as YAML-like line
function PathNodeLine({
  node,
  categoryId,
  categoryName,
  depth,
  isLast,
  onUpdate,
  onAddChild,
  onDelete,
  onMakeVariable,
}: {
  node: PathNode;
  categoryId: string;
  categoryName: string;
  depth: number;
  isLast: boolean;
  onUpdate: (catId: string, nodeId: string, name: string) => void;
  onAddChild: (catId: string, parentId: string) => void;
  onDelete: (catId: string, nodeId: string) => void;
  onMakeVariable: (catId: string, nodeId: string, currentName: string) => void;
}) {
  const isVariable = node.name.startsWith("$");
  const isLeaf = node.children.length === 0;

  return (
    <div className="group/node">
      <div className="flex items-center gap-1">
        {/* Tree connector */}
        <span className="text-zinc-700 select-none w-4 text-xs">{isLast ? "└" : "├"}</span>
        
        {/* Variable toggle button - larger and always visible */}
        <button 
          onClick={() => onMakeVariable(categoryId, node.id, node.name)}
          className={cn(
            "p-1.5 rounded-md transition-all flex items-center justify-center min-w-[28px] min-h-[28px]",
            isVariable 
              ? "text-cyan-400 bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30" 
              : "text-zinc-500 bg-zinc-800/50 border border-dashed border-zinc-700 hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-cyan-500/10"
          )}
          title={isVariable ? "Click to make static" : "Click to make variable ($)"}
        >
          <Variable className="h-4 w-4" />
        </button>

        {/* Node name */}
        <EditableField
          value={node.name}
          onChange={(v) => onUpdate(categoryId, node.id, v)}
          className={isVariable ? "text-cyan-400" : "text-zinc-300"}
          placeholder="segment"
        />

        {/* Leaf path preview */}
        {isLeaf && (
          <span className="text-zinc-600 text-[10px] ml-2 opacity-60">
            → {categoryName}:{node.name}
          </span>
        )}

        {/* Add child button - larger and always visible */}
        <button 
          onClick={() => onAddChild(categoryId, node.id)} 
          className="p-1.5 rounded-md transition-all flex items-center justify-center min-w-[28px] min-h-[28px] text-zinc-500 bg-zinc-800/50 border border-dashed border-zinc-700 hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10" 
          title="Add child segment"
        >
          <Plus className="h-4 w-4" />
        </button>
        
        {/* Delete button - larger and always visible */}
        <button 
          onClick={() => onDelete(categoryId, node.id)} 
          className="p-1.5 rounded-md transition-all flex items-center justify-center min-w-[28px] min-h-[28px] text-zinc-500 bg-zinc-800/50 border border-dashed border-zinc-700 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10" 
          title="Delete"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <div className="pl-5">
          {node.children.map((child, i) => (
            <PathNodeLine
              key={child.id}
              node={child}
              categoryId={categoryId}
              categoryName={categoryName}
              depth={depth + 1}
              isLast={i === node.children.length - 1}
              onUpdate={onUpdate}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onMakeVariable={onMakeVariable}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function updateNodeInTree(nodes: PathNode[], nodeId: string, newName: string): PathNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) return { ...n, name: newName };
    if (n.children.length > 0) return { ...n, children: updateNodeInTree(n.children, nodeId, newName) };
    return n;
  });
}

function addChildToNode(nodes: PathNode[], parentId: string): PathNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) {
      return { ...n, children: [...n.children, { id: genId(), name: "segment", children: [] }] };
    }
    if (n.children.length > 0) return { ...n, children: addChildToNode(n.children, parentId) };
    return n;
  });
}

function deleteNodeFromTree(nodes: PathNode[], nodeId: string): PathNode[] {
  return nodes.filter((n) => n.id !== nodeId).map((n) => ({
    ...n,
    children: deleteNodeFromTree(n.children, nodeId),
  }));
}
