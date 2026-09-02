import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hash } from "bcryptjs";
import { connectDatabase } from "../src/lib/db";
import { BOARD_TYPES, Post } from "../src/models/Post";
import { Reservation } from "../src/models/Reservation";
import { User } from "../src/models/User";

type LegacyComment = {
  writer?: string;
  real_writer?: string;
  content?: string;
  time?: string;
};

type LegacyPost = {
  author?: string;
  real_author?: string;
  datetime?: string;
  title?: string;
  content?: string;
  file?: string;
  views?: number;
  comments?: LegacyComment[];
  type?: "owner" | "item";
  location?: string;
};

type PendingUser = {
  pw: string;
  student_id?: string;
  name?: string;
  birth?: string;
};

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readJson<T>(source: string, filename: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(join(source, filename), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function postDate(value?: string): Date {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function main() {
  const source = resolve(argument("--source") ?? "..");
  const dryRun = process.argv.includes("--dry-run");
  const activeUsers = readJson<Record<string, string>>(
    source,
    "users.json",
    {},
  );
  const pendingUsers = readJson<Record<string, PendingUser>>(
    source,
    "pending_users.json",
    {},
  );
  const postGroups = [
    {
      board: "notice",
      posts: readJson<LegacyPost[]>(source, "notices.json", []),
    },
    { board: "free", posts: readJson<LegacyPost[]>(source, "free.json", []) },
    {
      board: "anonymous",
      posts: readJson<LegacyPost[]>(source, "anonymous.json", []),
    },
    {
      board: "lost",
      posts: readJson<LegacyPost[]>(source, "lost_found.json", []),
    },
  ] as const;

  const reservationDatabase = new DatabaseSync(
    join(source, "reservations.db"),
    { readOnly: true },
  );
  const reservations = reservationDatabase
    .prepare(
      "SELECT date, student_id, name, period, location FROM reservations",
    )
    .all() as Array<Record<string, string>>;
  reservationDatabase.close();

  const summary = {
    activeUsers: Object.keys(activeUsers).length,
    pendingUsers: Object.keys(pendingUsers).length,
    posts: postGroups.reduce((sum, group) => sum + group.posts.length, 0),
    reservations: reservations.length,
  };
  console.log("Legacy migration summary", summary);
  if (dryRun) return;

  await connectDatabase();
  const userIds = new Map<string, string>();

  for (const [loginId, password] of Object.entries(activeUsers)) {
    const role =
      loginId === "admin"
        ? "admin"
        : loginId === "Teacher"
          ? "teacher"
          : "student";
    const user = await User.findOneAndUpdate(
      { loginId },
      {
        $set: { role, status: "active", name: loginId },
        $setOnInsert: { passwordHash: await hash(password, 12) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    userIds.set(loginId, user._id.toString());
  }

  for (const [loginId, pending] of Object.entries(pendingUsers)) {
    const user = await User.findOneAndUpdate(
      { loginId },
      {
        $set: {
          status: "pending",
          role: "student",
          studentId: pending.student_id,
          name: pending.name || loginId,
          birthDate: pending.birth,
        },
        $setOnInsert: { passwordHash: await hash(pending.pw, 12) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    userIds.set(loginId, user._id.toString());
  }

  const migrationOwner = process.env.MIGRATION_OWNER_LOGIN_ID ?? "admin";
  const fallbackAuthorId = userIds.get(migrationOwner);
  if (!fallbackAuthorId)
    throw new Error(`Migration owner '${migrationOwner}' was not found.`);

  for (const group of postGroups) {
    for (const [legacyIndex, legacy] of group.posts.entries()) {
      const authorLoginId =
        legacy.real_author ?? legacy.author ?? migrationOwner;
      const authorId = userIds.get(authorLoginId) ?? fallbackAuthorId;
      const board: (typeof BOARD_TYPES)[number] =
        group.board === "lost"
          ? legacy.type === "owner"
            ? "lost-owner"
            : "lost-item"
          : group.board;
      await Post.findOneAndUpdate(
        { board, legacyIndex },
        {
          $set: {
            authorId,
            authorLoginId,
            title: legacy.title || "제목 없음",
            content: legacy.content || "",
            location: legacy.location,
            fileUrl: legacy.file ? `/legacy-uploads/${legacy.file}` : undefined,
            views: legacy.views ?? 0,
            createdAt: postDate(legacy.datetime),
            comments: (legacy.comments ?? []).map((comment) => ({
              authorId:
                userIds.get(comment.real_writer ?? comment.writer ?? "") ??
                fallbackAuthorId,
              writer:
                board === "anonymous"
                  ? "익명"
                  : (comment.writer ?? migrationOwner),
              content: comment.content ?? "",
              legacyTime: comment.time,
            })),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }

  for (const reservation of reservations) {
    const ownerId =
      userIds.get(reservation.student_id) ??
      userIds.get(reservation.name) ??
      fallbackAuthorId;
    await Reservation.updateOne(
      {
        date: reservation.date,
        studentId: reservation.student_id,
        period: reservation.period,
        location: reservation.location,
      },
      {
        $setOnInsert: {
          name: reservation.name,
          createdBy: ownerId,
          status: "scheduled",
        },
      },
      { upsert: true },
    );
  }

  console.log("Migration completed without storing plaintext passwords.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
