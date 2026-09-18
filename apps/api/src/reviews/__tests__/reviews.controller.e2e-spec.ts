import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory, User } from "../../../test/factory/user.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";
import {
  createQueueTestHarness,
  QueueTestHarness,
} from "../../../test/helpers/bullmq-test-utils";
import { InMemoryFileStorageAdapter } from "../../../test/helpers/test-file-storage.adapter";
import { FileStorageAdapter } from "src/file-storage/adapters/file-storage.adapter";
import { DatabasePg } from "src/common";
import { review } from "../reviews-schema";
import { REVIEW_QUEUE } from "../reviews.queue";

describe("ReviewsController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let testUser: User;
  let cookies: string;
  let userFactory: ReturnType<typeof createUserFactory>;
  let queueHarness: QueueTestHarness;
  const password = "password123";

  beforeAll(async () => {
    const { app: testApp, db: testDb } = await createE2ETest([
      {
        provide: FileStorageAdapter,
        useValue: new InMemoryFileStorageAdapter(),
      },
    ]);
    app = testApp;
    db = testDb;
    userFactory = createUserFactory(db);
    queueHarness = await createQueueTestHarness(app, REVIEW_QUEUE.name);
  }, 60000);

  afterAll(async () => {
    await queueHarness?.dispose();
    await app?.close();
  });

  beforeEach(async () => {
    testUser = userFactory.build();

    const registerResponse = await request(app.getHttpServer())
      .post("/api/auth/sign-up/email")
      .send({ email: testUser.email, password, name: testUser.name });

    testUser.id = registerResponse.body.user.id;
    cookies = registerResponse.headers["set-cookie"];
  });

  afterEach(async () => {
    await queueHarness?.cleanQueue();
    await truncateTables(db, ["review", "file", "user"]);
  });

  it("rejects unauthenticated access", async () => {
    await request(app.getHttpServer()).get("/api/v1/reviews").expect(401);
  });

  it("returns an empty list and zeroed stats for a new user", async () => {
    const list = await request(app.getHttpServer())
      .get("/api/v1/reviews")
      .set("Cookie", cookies)
      .expect(200);
    expect(list.body.data).toEqual([]);

    const stats = await request(app.getHttpServer())
      .get("/api/v1/reviews/stats")
      .set("Cookie", cookies)
      .expect(200);
    expect(stats.body.data.totalReviews).toBe(0);
    expect(stats.body.data.findingCounts.total).toBe(0);
  });

  it("rejects a review without files", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/reviews")
      .set("Cookie", cookies)
      .field("title", "empty")
      .expect(400);
  });

  it("creates a review from uploaded files, enqueues a job and processes it", async () => {
    const completion = queueHarness.waitForJobCompletion();

    const response = await request(app.getHttpServer())
      .post("/api/v1/reviews")
      .set("Cookie", cookies)
      .field("title", "demo upload")
      .field("aiEnabled", "true")
      .attach(
        "files",
        Buffer.from(
          'const key = "sk-ant-abcdefghijklmnopqrstuvwxyz0123";\nconsole.log(eval(x));\n',
        ),
        "config.ts",
      )
      .attach("files", Buffer.from("def run():\n    print('hi')\n"), "main.py")
      .expect(201);

    const created = response.body.data;
    expect(created.title).toBe("demo upload");
    expect(created.status).toBe("pending");
    expect(created.uploadCount).toBe(2);
    expect(created.sourceType).toBe("files");

    // The in-process BullMQ worker picks the job up; wait for it to finish.
    await completion;

    const details = await request(app.getHttpServer())
      .get(`/api/v1/reviews/${created.id}`)
      .set("Cookie", cookies)
      .expect(200);

    const data = details.body.data;
    expect(data.status).toBe("completed");
    expect(data.fileCount).toBe(2);
    expect(
      data.files.map((file: { path: string }) => file.path).sort(),
    ).toEqual(["config.ts", "main.py"]);
    expect(data.aiModel).toBe("mock-reviewer");

    const rules = data.findings.map(
      (finding: { rule: string }) => finding.rule,
    );
    expect(rules).toContain("hardcoded-secret");
    expect(rules).toContain("eval-usage");
    expect(data.findings[0].priority).toBe("critical");
    expect(data.findingCounts.total).toBe(data.findings.length);
  }, 30000);

  it("does not expose another user's review", async () => {
    const [foreign] = await db
      .insert(review)
      .values({
        userId: testUser.id,
        title: "mine",
        sourceType: "files",
        uploadCount: 1,
      })
      .returning();

    const other = userFactory.build();
    const otherRegister = await request(app.getHttpServer())
      .post("/api/auth/sign-up/email")
      .send({ email: other.email, password, name: other.name });

    await request(app.getHttpServer())
      .get(`/api/v1/reviews/${foreign.id}`)
      .set("Cookie", otherRegister.headers["set-cookie"])
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/reviews/${foreign.id}`)
      .set("Cookie", cookies)
      .expect(200);

    const remaining = await db
      .select()
      .from(review)
      .where(eq(review.id, foreign.id));
    expect(remaining).toHaveLength(0);
  });
});
