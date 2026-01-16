import { z } from "zod";

export type ChoiceKey = "A" | "B" | "C" | "D" | "E";

export type ChoiceV1 = { key: ChoiceKey; text: string };

export type AnswerValueV1 = string | string[];

export type QuestionLevel = "basic" | "advanced";

export type QuestionBaseV1 = {
  uid: string;
  subject: "discrete-math";
  id: string;
  topic: string;
  level: QuestionLevel;
  number: number;
  prompt: string;
};

export type QuestionMcqPublicV1 = QuestionBaseV1 & {
  type: "mcq-single";
  choices: ChoiceV1[];
};

export type QuestionFillBlankPublicV1 = QuestionBaseV1 & {
  type: "fill-blank";
  blankCount: number;
};

export type QuestionPublicV1 = QuestionMcqPublicV1 | QuestionFillBlankPublicV1;

export type QuestionMcqAnswersV1 = QuestionMcqPublicV1 & {
  answerKey: ChoiceKey;
  solution: string;
};

export type QuestionFillBlankAnswersV1 = QuestionFillBlankPublicV1 & {
  answers: string[];
  solution: string;
};

export type QuestionAnswersV1 = QuestionMcqAnswersV1 | QuestionFillBlankAnswersV1;

export type BankPublicV1 = {
  version: "v1";
  subject: "discrete-math";
  generatedAt: string;
  questions: QuestionPublicV1[];
};

export type BankAnswersV1 = {
  version: "v1";
  subject: "discrete-math";
  generatedAt: string;
  questions: QuestionAnswersV1[];
};

export type ExamCompositionLevel = QuestionLevel | "none";

export type ExamCompositionItemV1 = {
  topic: string;
  level: ExamCompositionLevel;
  n: number;
};

export type ExamVisibility = "public" | "private";

export type ExamPolicyV1 = {
  authMode: "required" | "optional" | "none";
  requireViewCode: boolean;
  requireSubmitCode: boolean;
  solutionsMode: "never" | "after_submit" | "always";
  timeLimitMinutes?: number;
  versioningMode?: "fixed" | "per_student";
  versionCount?: number;
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
  language?: "en" | "vi";
};

export type ExamVersionInfoV1 = {
  versionId: string;
  versionIndex?: number;
};

export type BankResponseV1 = {
  version: ExamVersionInfoV1;
  questions: QuestionPublicV1[];
};

export type AnswerDraftV1 = {
  version: "v1";
  examId: string;
  versionId: string;
  savedAtISO: string;
  answers: Record<string, AnswerValueV1>;
};

export type ExamV1 = {
  examId: string;
  subject: "discrete-math";
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  title?: string;
  seed: string;
  composition: ExamCompositionItemV1[];
  questionUids: string[];
  policy: ExamPolicyV1;
  codesHashed: string[];
  expiresAt?: string;
  visibility?: ExamVisibility;
  notice?: string;
};

export type SubmissionIdentityV1 = {
  provider: "github" | "google" | "anon";
  userId: string;
  name?: string;
  username?: string;
  email?: string;
};

export type SubmissionPerQuestionV1 = {
  uid: string;
  chosen: AnswerValueV1;
  correct: boolean;
  answerKey?: ChoiceKey;
  expected?: string[];
  solution?: string;
  prompt?: string;
  choices?: ChoiceV1[];
};

export type SubmissionV1 = {
  submissionId: string;
  examId: string;
  submittedAt: string;
  owner: { appUserId?: string; anonymousId?: string };
  identity: SubmissionIdentityV1;
  answers: Record<string, AnswerValueV1>;
  score: { correct: number; total: number };
  perQuestion: SubmissionPerQuestionV1[];
  version?: ExamVersionInfoV1;
  deletedAt?: string;
};

export type SubmissionSummaryV1 = {
  submissionId: string;
  examId: string;
  submittedAt: string;
  score: { correct: number; total: number };
  version?: ExamVersionInfoV1;
  deletedAt?: string;
};

export type AppUser = {
  appUserId: string;
  createdAt: string;
  updatedAt: string;
  roles: string[];
  profile: { displayName?: string; email?: string };
  linked: {
    github?: { userId: string; username?: string; email?: string };
    google?: { sub: string; email?: string; name?: string };
  };
};

export type SessionV2 = {
  appUserId: string;
  roles: string[];
  providers: ("github" | "google" | "anon")[];
  displayName?: string;
};

export const ChoiceKeySchema = z.enum(["A", "B", "C", "D", "E"]);

export const ChoiceSchema = z.object({
  key: ChoiceKeySchema,
  text: z.string()
});

export const AnswerValueV1Schema = z.union([z.string(), z.array(z.string())]);

const QuestionBaseV1Schema = z.object({
  uid: z.string().regex(/^latex:MAT3500:.+$/),
  subject: z.literal("discrete-math"),
  id: z.string(),
  topic: z.string(),
  level: z.enum(["basic", "advanced"]),
  number: z.number().int(),
  prompt: z.string()
});

export const QuestionMcqPublicV1Schema = QuestionBaseV1Schema.extend({
  type: z.literal("mcq-single"),
  choices: z.array(ChoiceSchema)
});

export const QuestionFillBlankPublicV1Schema = QuestionBaseV1Schema.extend({
  type: z.literal("fill-blank"),
  blankCount: z.number().int().min(1)
});

export const QuestionPublicV1Schema = z.discriminatedUnion("type", [
  QuestionMcqPublicV1Schema,
  QuestionFillBlankPublicV1Schema
]);

export const QuestionMcqAnswersV1Schema = QuestionMcqPublicV1Schema.extend({
  answerKey: ChoiceKeySchema,
  solution: z.string()
});

export const QuestionFillBlankAnswersV1Schema = QuestionFillBlankPublicV1Schema.extend({
  answers: z.array(z.string()),
  solution: z.string()
});

export const QuestionAnswersV1Schema = z.discriminatedUnion("type", [
  QuestionMcqAnswersV1Schema,
  QuestionFillBlankAnswersV1Schema
]);

export const BankPublicV1Schema = z.object({
  version: z.literal("v1"),
  subject: z.literal("discrete-math"),
  generatedAt: z.string().datetime(),
  questions: z.array(QuestionPublicV1Schema)
});

export const BankAnswersV1Schema = z.object({
  version: z.literal("v1"),
  subject: z.literal("discrete-math"),
  generatedAt: z.string().datetime(),
  questions: z.array(QuestionAnswersV1Schema)
});

export const ExamCompositionItemSchema = z.object({
  topic: z.string(),
  level: z.enum(["basic", "advanced", "none"]),
  n: z.number().int()
});

export const ExamPolicySchema = z.object({
  language: z.enum(["en", "vi"]).optional().default("vi"),
  authMode: z.enum(["required", "optional", "none"]),
  requireViewCode: z.boolean(),
  requireSubmitCode: z.boolean(),
  solutionsMode: z.enum(["never", "after_submit", "always"]),
  timeLimitMinutes: z.number().int().min(1).max(300).optional(),
  versioningMode: z.enum(["fixed", "per_student"]).optional(),
  versionCount: z.number().int().min(2).max(50).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleChoices: z.boolean().optional()
});

export const ExamV1Schema = z.object({
  examId: z.string(),
  subject: z.literal("discrete-math"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  deletedAt: z.string().datetime().optional(),
  title: z.string().optional(),
  seed: z.string(),
  composition: z.array(ExamCompositionItemSchema),
  questionUids: z.array(z.string()),
  policy: ExamPolicySchema,
  codesHashed: z.array(z.string()),
  expiresAt: z.string().datetime().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  notice: z.string().optional()
});

export const SubmissionIdentitySchema = z.object({
  provider: z.enum(["github", "google", "anon"]),
  userId: z.string(),
  name: z.string().optional(),
  username: z.string().optional(),
  email: z.string().optional()
});

export const SubmissionPerQuestionSchema = z.object({
  uid: z.string(),
  chosen: AnswerValueV1Schema,
  correct: z.boolean(),
  answerKey: ChoiceKeySchema.optional(),
  expected: z.array(z.string()).optional(),
  solution: z.string().optional(),
  prompt: z.string().optional(),
  choices: z.array(ChoiceSchema).optional()
});

export const SubmissionOwnerSchema = z
  .object({
    appUserId: z.string().optional(),
    anonymousId: z.string().optional()
  })
  .refine((data) => Boolean(data.appUserId || data.anonymousId), {
    message: "Owner must include appUserId or anonymousId"
  });

export const SubmissionV1Schema = z.object({
  submissionId: z.string(),
  examId: z.string(),
  submittedAt: z.string().datetime(),
  owner: SubmissionOwnerSchema,
  identity: SubmissionIdentitySchema,
  answers: z.record(z.string(), AnswerValueV1Schema),
  score: z.object({
    correct: z.number().int(),
    total: z.number().int()
  }),
  perQuestion: z.array(SubmissionPerQuestionSchema),
  version: z
    .object({
      versionId: z.string(),
      versionIndex: z.number().int().optional()
    })
    .optional(),
  deletedAt: z.string().datetime().optional()
});

export const SubmissionSummaryV1Schema = z.object({
  submissionId: z.string(),
  examId: z.string(),
  submittedAt: z.string().datetime(),
  score: z.object({
    correct: z.number().int(),
    total: z.number().int()
  }),
  version: z
    .object({
      versionId: z.string(),
      versionIndex: z.number().int().optional()
    })
    .optional(),
  deletedAt: z.string().datetime().optional()
});

export const ExamVersionInfoV1Schema = z.object({
  versionId: z.string(),
  versionIndex: z.number().int().optional()
});

export const BankResponseV1Schema = z.object({
  version: ExamVersionInfoV1Schema,
  questions: z.array(QuestionPublicV1Schema)
});

export const AppUserSchema = z.object({
  appUserId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  roles: z.array(z.string()),
  profile: z.object({
    displayName: z.string().optional(),
    email: z.string().optional()
  }),
  linked: z.object({
    github: z
      .object({
        userId: z.string(),
        username: z.string().optional(),
        email: z.string().optional()
      })
      .optional(),
    google: z
      .object({
        sub: z.string(),
        email: z.string().optional(),
        name: z.string().optional()
      })
      .optional()
  })
});

export const SessionV2Schema = z.object({
  appUserId: z.string(),
  roles: z.array(z.string()),
  providers: z.array(z.enum(["github", "google", "anon"])),
  displayName: z.string().optional()
});

const secretRefSchema = z.string().regex(/^[a-zA-Z0-9-_]{1,60}$/, {
  message: "secretRef must be alphanumeric with dashes/underscores (max 60 chars)"
});

const relativeDirSchema = z
  .string()
  .min(1)
  .refine(
    (val) => !val.startsWith("/") && !val.split("/").some((part) => part === ".."),
    { message: "dir must be relative and cannot contain '..'" }
  );

const GitHubSourceDefV1Schema = z.object({
  id: z.string().min(1),
  type: z.literal("github"),
  repo: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, { message: "repo must be OWNER/REPO" }),
  branch: z.string().min(1),
  dir: relativeDirSchema,
  format: z.enum(["latex", "canvas"]).optional(),
  auth: z
    .object({
      kind: z.literal("githubToken"),
      secretRef: secretRefSchema
    })
    .optional()
});

const ZipSourceDefV1Schema = z.object({
  id: z.string().min(1),
  type: z.literal("zip"),
  url: z
    .string()
    .url()
    .refine((val) => val.startsWith("https://"), { message: "url must use https" }),
  dir: relativeDirSchema.optional(),
  format: z.enum(["latex", "canvas"]).optional(),
  auth: z
    .object({
      kind: z.literal("httpHeader"),
      secretRef: secretRefSchema
    })
    .optional()
});

const CanvasSourceDefV1Schema = z.object({
  id: z.string().min(1),
  type: z.literal("canvas"),
  url: z
    .string()
    .url()
    .refine((val) => val.startsWith("https://"), { message: "url must use https" }),
  auth: z
    .object({
      kind: z.literal("httpHeader"),
      secretRef: secretRefSchema
    })
    .optional()
});

const GoogleDriveFolderSourceDefV1Schema = z.object({
  id: z.string().min(1),
  type: z.literal("gdrive"),
  folderId: z
    .string()
    .min(5)
    .regex(/^[A-Za-z0-9_-]+$/, { message: "folderId must be alphanumeric with dashes/underscores" }),
  format: z.enum(["latex", "canvas"]).optional(),
  auth: z
    .object({
      kind: z.literal("httpHeader"),
      secretRef: secretRefSchema
    })
    .optional()
});

const SourceDefSchema = z.union([
  GitHubSourceDefV1Schema,
  ZipSourceDefV1Schema,
  CanvasSourceDefV1Schema,
  GoogleDriveFolderSourceDefV1Schema
]);

export const SourcesConfigV1Schema = z
  .object({
    version: z.literal("v1"),
    courseCode: z.string().min(1),
    subject: z.string().min(1),
    uidNamespace: z.string().min(1),
    sources: z.array(SourceDefSchema)
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    for (const [index, source] of data.sources.entries()) {
      if (ids.has(source.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "id must be unique",
          path: ["sources", index, "id"]
        });
      }
      ids.add(source.id);
    }
  });

export type GitHubSourceDefV1 = z.infer<typeof GitHubSourceDefV1Schema>;
export type ZipSourceDefV1 = z.infer<typeof ZipSourceDefV1Schema>;
export type CanvasSourceDefV1 = z.infer<typeof CanvasSourceDefV1Schema>;
export type GoogleDriveFolderSourceDefV1 = z.infer<typeof GoogleDriveFolderSourceDefV1Schema>;
export type SourcesConfigV1 = z.infer<typeof SourcesConfigV1Schema>;

export function validateSourcesConfig(config: unknown): SourcesConfigV1 {
  return SourcesConfigV1Schema.parse(config);
}

export function parseQuestionId(id: string): {
  topic: string;
  level: "basic" | "advanced";
  number: number;
} {
  const normalized = id.trim();
  const advancedMatch = /^advance([a-z0-9-]+):q(\d+)$/i.exec(normalized);
  if (advancedMatch) {
    const [, topic, num] = advancedMatch;
    return { topic: topic.toLowerCase(), level: "advanced", number: parseInt(num, 10) };
  }

  const basicPrefixedMatch = /^basic([a-z0-9-]+):q(\d+)$/i.exec(normalized);
  if (basicPrefixedMatch) {
    const [, topic, num] = basicPrefixedMatch;
    return { topic: topic.toLowerCase(), level: "basic", number: parseInt(num, 10) };
  }

  const genericMatch = /^([a-z0-9-]+):q(\d+)$/i.exec(normalized);
  if (genericMatch) {
    const [, topic, num] = genericMatch;
    return { topic: topic.toLowerCase(), level: "basic", number: parseInt(num, 10) };
  }

  throw new Error(`Invalid question id: ${id}`);
}

export function makeUid(courseCode: string, questionId: string): string {
  return `latex:${courseCode}:${questionId}`;
}

export function hasRole(session: SessionV2, role: string): boolean {
  return session.roles.includes(role);
}

export function isLoggedInUser(session: SessionV2): boolean {
  return session.providers.includes("github") || session.providers.includes("google");
}

export function assertAppUserId(session: SessionV2): string {
  if (!session.appUserId) {
    throw new Error("Session missing appUserId");
  }
  return session.appUserId;
}

export type NormalizedExamPolicyV1 = ExamPolicyV1 & {
  versioningMode: "fixed" | "per_student";
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
};

export function normalizeExamVisibility(visibility?: ExamVisibility): ExamVisibility {
  return visibility ?? "private";
}

export function normalizeExamPolicyDefaults(policy: ExamPolicyV1): NormalizedExamPolicyV1 {
  const versioningMode = policy.versioningMode ?? "fixed";
  const shuffleQuestions =
    policy.shuffleQuestions ?? (versioningMode === "per_student" ? true : false);
  const shuffleChoices = policy.shuffleChoices ?? false;
  return {
    ...policy,
    versioningMode,
    shuffleQuestions,
    shuffleChoices
  };
}

// Legacy exports kept for compatibility with existing packages.
export type Bank = { id: string; name: string; country: string };

export const baseBanks: Bank[] = [
  { id: "shared_001", name: "Shared Savings", country: "US" },
  { id: "shared_002", name: "Continental Trust", country: "CA" }
];

export const sharedVersion = "0.0.1";

export function formatBank(bank: Bank): string {
  return `${bank.name} (${bank.country})`;
}

export type { TopicCategory, TopicDefinition } from "./topics.js";
export { getTopicTitle, getTopicCategory, getCategoryById, getSubtopicIdsForCategory, isTopicCategory, topicCatalog } from "./topics.js";
