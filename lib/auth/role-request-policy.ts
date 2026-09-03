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

/** Không có điều kiện = công khai; có điều kiện = chỉ cần thỏa một điều kiện (OR). */
export function canSeeRoleRequest(
    requiredRoleIds: readonly string[],
    heldRoleIds: ReadonlySet<string>,
): boolean {
    return requiredRoleIds.length === 0 || requiredRoleIds.some((id) => heldRoleIds.has(id));
}
