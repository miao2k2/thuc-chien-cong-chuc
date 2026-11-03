export type UserRole = "GUEST" | "MANAGER" | "ADMIN";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
};

export type Session = {
  user: SessionUser;
  expiresAt: string;
};

export const ROLE_LABEL: Record<UserRole, string> = {
  GUEST: "Guest",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

export const ROLE_COLOR: Record<UserRole, string> = {
  GUEST: "default",
  MANAGER: "blue",
  ADMIN: "red",
};
