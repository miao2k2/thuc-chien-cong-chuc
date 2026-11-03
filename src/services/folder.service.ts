import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type FolderNode = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  inheritCategoryRoles: boolean;
  categoryRoleIds: string[]; // gán trực tiếp
  effectiveCategoryRoleIds: string[]; // sau khi kế thừa
  questionCount: number;
  children: FolderNode[];
};

type FolderRow = Prisma.FolderGetPayload<{
  include: {
    categoryRoles: true;
    _count: { select: { questions: true } };
  };
}>;

/**
 * Tính category role hiệu lực của 1 folder.
 * - Folder gắn trực tiếp (inheritCategoryRoles = false): dùng đúng các role gắn trực tiếp.
 * - Folder kế thừa (mặc định = true): lấy role của cha, cộng thêm role gắn trực tiếp.
 *   Nếu là folder gốc thì không có cha => chỉ dùng role gắn trực tiếp.
 */
export async function resolveEffectiveCategoryRoleIds(
  folderId: string,
): Promise<string[]> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: { categoryRoles: true },
  });
  if (!folder) return [];

  const direct = folder.categoryRoles.map((r) => r.categoryRoleId);

  if (!folder.inheritCategoryRoles) return unique(direct);

  if (!folder.parentId) return unique(direct);

  const parentIds = await resolveEffectiveCategoryRoleIds(folder.parentId);
  return unique([...parentIds, ...direct]);
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export async function getFolderTree(): Promise<FolderNode[]> {
  const folders = await prisma.folder.findMany({
    include: {
      categoryRoles: true,
      _count: { select: { questions: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const byId = new Map<string, FolderNode>();
  for (const f of folders) {
    byId.set(f.id, {
      id: f.id,
      name: f.name,
      description: f.description,
      parentId: f.parentId,
      sortOrder: f.sortOrder,
      inheritCategoryRoles: f.inheritCategoryRoles,
      categoryRoleIds: f.categoryRoles.map((r) => r.categoryRoleId),
      effectiveCategoryRoleIds: [],
      questionCount: f._count.questions,
      children: [],
    });
  }

  // tính effective role theo thứ tự cha trước con
  const computeEffective = (node: FolderNode): string[] => {
    if (node.parentId) {
      const parent = byId.get(node.parentId);
      if (parent) {
        const parentEffective = computeEffective(parent);
        if (node.inheritCategoryRoles) {
          node.effectiveCategoryRoleIds = unique([
            ...parentEffective,
            ...node.categoryRoleIds,
          ]);
        } else {
          node.effectiveCategoryRoleIds = unique(node.categoryRoleIds);
        }
        return node.effectiveCategoryRoleIds;
      }
    }
    node.effectiveCategoryRoleIds = unique(node.categoryRoleIds);
    return node.effectiveCategoryRoleIds;
  };

  const roots: FolderNode[] = [];
  for (const node of byId.values()) {
    computeEffective(node);
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);

  return roots;
}

/** Lấy tất cả folder con (bao gồm chính nó) dạng id list. */
export async function getFolderDescendantIds(folderId: string): Promise<string[]> {
  const all = await prisma.folder.findMany({ select: { id: true, parentId: true } });
  const childrenMap = new Map<string, string[]>();
  for (const f of all) {
    if (!f.parentId) continue;
    const list = childrenMap.get(f.parentId) ?? [];
    list.push(f.id);
    childrenMap.set(f.parentId, list);
  }
  const result: string[] = [];
  const walk = (id: string) => {
    result.push(id);
    for (const child of childrenMap.get(id) ?? []) walk(child);
  };
  walk(folderId);
  return result;
}

/** Đường dẫn đầy đủ của folder: A / B / C */
export async function getFolderPath(folderId: string): Promise<string> {
  const parts: string[] = [];
  let currentId: string | null = folderId;
  while (currentId) {
    const f: { name: string; parentId: string | null } | null =
      await prisma.folder.findUnique({
        where: { id: currentId },
        select: { name: true, parentId: true },
      });
    if (!f) break;
    parts.unshift(f.name);
    currentId = f.parentId;
  }
  return parts.join(" / ");
}

export async function listAllFolders() {
  return prisma.folder.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { questions: true } } },
  });
}
