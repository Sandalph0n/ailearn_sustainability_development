import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
    // Trỏ vào THƯ MỤC, không phải một file. Prisma ghép mọi `.prisma` bên trong lại — đó là thứ
    // cho phép tách mỗi bảng ra một file ở `prisma/schema/models/`.
    schema: "prisma/schema",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: process.env["DATABASE_URL"],
    },
});
