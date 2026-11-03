import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFolderTree } from "@/services/folder.service";
import { z } from "zod";

export async function GET() {
  try {
    await requireRole("MANAGER", "ADMIN");
    const [tree, categoryRoles] = await Promise.all([
      getFolderTree(),
      prisma.categoryRole.findMany({ orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ tree, categoryRoles });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

const createSchema = z.object({
  name: z.string().min(1, "Tên thư mục không được để trống"),
  description: z.string().optional(),
  parentId: z.string().nullable().optional(),
  categoryRoleIds: z.array(z.string()).optional(),
  inheritCategoryRoles: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const body = createSchema.parse(await req.json());
    const parentId = body.parentId ?? null;

    const dup = await prisma.folder.findFirst({
      where: { name: body.name.trim(), parentId },
    });
    if (dup) {
      return NextResponse.json(
        { error: "Đã tồn tại thư mục cùng tên trong thư mục cha" },
        { status: 409 },
      );
    }

    const folder = await prisma.folder.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        parentId,
        inheritCategoryRoles: body.inheritCategoryRoles ?? true,
        categoryRoles: body.categoryRoleIds?.length
          ? { create: body.categoryRoleIds.map((id) => ({ categoryRoleId: id })) }
          : undefined,
      },
      include: { categoryRoles: true },
    });
    return NextResponse.json({ ok: true, folder });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
        { status: 400 },
      );
    }
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

const updateSchema = z.object({
  folderId: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  parentId: z.string().nullable().optional(),
  categoryRoleIds: z.array(z.string()).optional(),
  inheritCategoryRoles: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const body = updateSchema.parse(await req.json());

    // chặn tạo vòng lặp khi đổi thư mục cha
    if (body.parentId) {
      let cursor: string | null = body.parentId;
      const seen = new Set<string>();
      while (cursor) {
        if (cursor === body.folderId) {
          return NextResponse.json(
            { error: "Không thể chuyển thư mục vào chính nó hoặc thư mục con của nó" },
            { status: 400 },
          );
        }
        if (seen.has(cursor)) break;
        seen.add(cursor);
        const f: { parentId: string | null } | null = await prisma.folder.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
        cursor = f?.parentId ?? null;
      }
    }

    const folder = await prisma.$transaction(async (tx) => {
      if (body.categoryRoleIds) {
        await tx.folderCategoryRole.deleteMany({
          where: { folderId: body.folderId },
        });
        if (body.categoryRoleIds.length) {
          await tx.folderCategoryRole.createMany({
            data: body.categoryRoleIds.map((id) => ({
              folderId: body.folderId,
              categoryRoleId: id,
            })),
          });
        }
      }
      return tx.folder.update({
        where: { id: body.folderId },
        data: {
          ...(body.name ? { name: body.name.trim() } : {}),
          ...(body.description !== undefined
            ? { description: body.description.trim() || null }
            : {}),
          ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
          ...(body.inheritCategoryRoles !== undefined
            ? { inheritCategoryRoles: body.inheritCategoryRoles }
            : {}),
        },
        include: { categoryRoles: true },
      });
    });

    return NextResponse.json({ ok: true, folder });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
        { status: 400 },
      );
    }
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    await prisma.folder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
