export type PermAction = "VIEW" | "ADD" | "EDIT" | "DELETE";

export interface MeData {
  id: string;
  name: string | null;
  email: string;
  role: string;
  propertyAccess: { propertyId: string; permissions: PermAction[] }[];
  venueAccess: { venueId: string; permissions: PermAction[] }[];
  menuAccess: { menuId: string; permissions: PermAction[] }[];
}

export function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canOnProperty(me: MeData, action: PermAction, propertyId: string) {
  if (isAdmin(me.role)) return true;
  return me.propertyAccess.some(
    (a) => a.propertyId === propertyId && a.permissions.includes(action)
  );
}

export function canOnVenue(me: MeData, action: PermAction, venueId: string) {
  if (isAdmin(me.role)) return true;
  return me.venueAccess.some(
    (a) => a.venueId === venueId && a.permissions.includes(action)
  );
}

export function canOnMenu(me: MeData, action: PermAction, menuId: string) {
  if (isAdmin(me.role)) return true;
  return me.menuAccess.some(
    (a) => a.menuId === menuId && a.permissions.includes(action)
  );
}
