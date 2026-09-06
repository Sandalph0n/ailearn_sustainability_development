/**
 * Địa chỉ công khai của một tấm ảnh trong bucket `media`.
 *
 * Một hàm nhỏ nhưng đứng riêng, vì cả Server lẫn Client Component đều cần nó và nó phải nói ra
 * cùng một chuỗi ở hai phía — lệch nhau là ảnh vỡ mà không ai biết vì sao.
 */
export function pictureUrl(key: string | null | undefined): string | undefined {
    return key ? `/api/media/${key}` : undefined;
}
