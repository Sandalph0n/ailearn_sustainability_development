/** Một cạnh `includingRole -> includedRole` trong đồ thị kế thừa vai trò. */
export type RoleInclusionEdge = {
    includingRoleId: string;
    includedRoleId: string;
};

/**
 * Mở rộng các role được gán trực tiếp thành toàn bộ role người dùng thực sự đang giữ.
 * Diamond không làm lặp vô hạn vì Set chỉ đưa mỗi role vào hàng đợi một lần; chu trình vốn đã
 * bị database từ chối.
 */
export function effectiveRoleIds(
    assignedRoleIds: Iterable<string>,
    inclusions: readonly RoleInclusionEdge[],
): Set<string> {
    const effective = new Set(assignedRoleIds);
    const descendants = new Map<string, string[]>();

    for (const edge of inclusions) {
        const current = descendants.get(edge.includingRoleId);
        if (current) current.push(edge.includedRoleId);
        else descendants.set(edge.includingRoleId, [edge.includedRoleId]);
    }

    const queue = [...effective];
    for (let index = 0; index < queue.length; index += 1) {
        for (const includedRoleId of descendants.get(queue[index]) ?? []) {
            if (effective.has(includedRoleId)) continue;
            effective.add(includedRoleId);
            queue.push(includedRoleId);
        }
    }

    return effective;
}

export type RoleRequestMode = 'DISABLED' | 'PUBLIC' | 'CONDITIONAL';

/**
 * Cùng một policy được dùng để lọc GET và xác thực POST.
 * `CONDITIONAL` không có rule là cấu hình đóng, không vô tình trở thành public.
 */
export function canRequestRole(
    requestMode: RoleRequestMode,
    requiredRoleIds: readonly string[],
    heldRoleIds: ReadonlySet<string>,
): boolean {
    if (requestMode === 'DISABLED') return false;
    if (requestMode === 'PUBLIC') return true;
    return requiredRoleIds.some((id) => heldRoleIds.has(id));
}
