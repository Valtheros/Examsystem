import {
  REQUEST_STATUSES,
  ROLES,
  type AppRole,
  type RequestStatus,
} from "./constants";
import { AuthorizationError, ConflictError } from "./errors";

type RequestAccessContext = {
  role: AppRole;
  userId: string;
  instructorId: string;
  status: RequestStatus;
  cancelledAt?: Date | null;
};

const allowedTransitions: Record<RequestStatus, readonly RequestStatus[]> = {
  [REQUEST_STATUSES.DRAFT]: [REQUEST_STATUSES.PENDING_REVIEW],
  [REQUEST_STATUSES.PENDING_REVIEW]: [
    REQUEST_STATUSES.RETURNED,
    REQUEST_STATUSES.CUTTING,
  ],
  [REQUEST_STATUSES.RETURNED]: [REQUEST_STATUSES.PENDING_REVIEW],
  [REQUEST_STATUSES.CUTTING]: [REQUEST_STATUSES.PRINTING],
  [REQUEST_STATUSES.PRINTING]: [REQUEST_STATUSES.PRINTED],
  [REQUEST_STATUSES.PRINTED]: [REQUEST_STATUSES.DELIVERED],
  [REQUEST_STATUSES.DELIVERED]: [],
};

const transitionRoles: Partial<Record<RequestStatus, readonly AppRole[]>> = {
  [REQUEST_STATUSES.PENDING_REVIEW]: [ROLES.INSTRUCTOR],
  [REQUEST_STATUSES.RETURNED]: [ROLES.AV_UNIT],
  [REQUEST_STATUSES.CUTTING]: [ROLES.AV_UNIT],
  [REQUEST_STATUSES.PRINTING]: [ROLES.AV_UNIT],
  [REQUEST_STATUSES.PRINTED]: [ROLES.AV_UNIT],
  [REQUEST_STATUSES.DELIVERED]: [ROLES.AV_UNIT],
};

export function canViewRequest(context: RequestAccessContext) {
  if (context.role === ROLES.INSTRUCTOR) {
    return context.userId === context.instructorId;
  }
  return true;
}

export function canEditRequest(context: RequestAccessContext) {
  return (
    context.role === ROLES.INSTRUCTOR &&
    context.userId === context.instructorId &&
    !context.cancelledAt &&
    [REQUEST_STATUSES.DRAFT, REQUEST_STATUSES.RETURNED].includes(
      context.status as
        | typeof REQUEST_STATUSES.DRAFT
        | typeof REQUEST_STATUSES.RETURNED,
    )
  );
}

export function canCancelRequest(context: RequestAccessContext) {
  return (
    context.role === ROLES.INSTRUCTOR &&
    context.userId === context.instructorId &&
    !context.cancelledAt &&
    [
      REQUEST_STATUSES.DRAFT,
      REQUEST_STATUSES.PENDING_REVIEW,
      REQUEST_STATUSES.RETURNED,
    ].includes(
      context.status as
        | typeof REQUEST_STATUSES.DRAFT
        | typeof REQUEST_STATUSES.PENDING_REVIEW
        | typeof REQUEST_STATUSES.RETURNED,
    )
  );
}

export function canDownloadExamFile(context: RequestAccessContext) {
  if (context.cancelledAt) return false;
  if (context.role === ROLES.ADMIN) return true;
  if (context.role === ROLES.INSTRUCTOR) {
    return context.userId === context.instructorId;
  }
  if (context.role === ROLES.AV_UNIT) {
    return [
      REQUEST_STATUSES.CUTTING,
      REQUEST_STATUSES.PRINTING,
      REQUEST_STATUSES.PRINTED,
    ].includes(
      context.status as
        | typeof REQUEST_STATUSES.CUTTING
        | typeof REQUEST_STATUSES.PRINTING
        | typeof REQUEST_STATUSES.PRINTED,
    );
  }
  return false;
}

export function canUploadExamFile(
  context: RequestAccessContext,
  kind: "ต้นฉบับ" | "พร้อมพิมพ์",
) {
  if (kind === "ต้นฉบับ") return canEditRequest(context);
  return (
    context.role === ROLES.AV_UNIT &&
    !context.cancelledAt &&
    [REQUEST_STATUSES.CUTTING, REQUEST_STATUSES.PRINTING].includes(
      context.status as
        | typeof REQUEST_STATUSES.CUTTING
        | typeof REQUEST_STATUSES.PRINTING,
    )
  );
}

export function assertRequestTransition(
  from: RequestStatus,
  to: RequestStatus,
  role: AppRole,
  isOwner: boolean,
) {
  if (!allowedTransitions[from].includes(to)) {
    throw new ConflictError(`ไม่สามารถเปลี่ยนสถานะจาก “${from}” เป็น “${to}” ได้`);
  }

  if (!transitionRoles[to]?.includes(role)) {
    throw new AuthorizationError("บทบาทนี้ไม่มีสิทธิ์เปลี่ยนเป็นสถานะที่เลือก");
  }

  if (role === ROLES.INSTRUCTOR && !isOwner) {
    throw new AuthorizationError("อาจารย์จัดการได้เฉพาะคำขอของตนเอง");
  }
}

export function assertRole(role: string, allowed: readonly AppRole[]) {
  if (!allowed.includes(role as AppRole)) {
    throw new AuthorizationError();
  }
}
